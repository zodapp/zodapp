import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@zodapp/zod-dynamodb-client";
import { endpoints } from "../src/shared";

export const DEV_PASSWORD = "Passw0rd!";
const MAIL_API = "http://localhost:2501";

/** テストごとに重ならない名前 */
export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** メールの記録から、宛先に届いた最新の確認コードを取る */
export const waitForConfirmationCode = async (to: string): Promise<string> => {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAIL_API}/messages/latest?to=${encodeURIComponent(to)}`);
        if (!res.ok) return undefined;
        const mail = (await res.json()) as { text?: string; subject?: string };
        code = /\b(\d{6})\b/.exec(mail.text ?? mail.subject ?? "")?.[1];
        return code;
      },
      { timeout: 15_000, message: `confirmation mail to ${to}` },
    )
    .toBeTruthy();
  return code!;
};

export const login = async (page: Page, email: string, password = DEV_PASSWORD) => {
  await page.goto("/survey/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page).toHaveURL(/\/survey\/workspaces/);
};

/** 別の利用者として、別のブラウザ（コンテキスト）を開いてログインする */
export const openAs = async (browser: Browser, email: string, videoDir?: string) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    ...(videoDir ? { recordVideo: { dir: videoDir } } : {}),
  });
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
};

/** ログイン済みのページから、ID トークンを取る（API を直接呼ぶ確認に使う） */
export const idTokenOf = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith(".idToken"));
    return key ? (localStorage.getItem(key) ?? "") : "";
  });

/**
 * テストの前提（ワークスペースやプロジェクト）を、画面を通さずに API で作るためのクライアント。
 * magnito で ID トークンを取り、登録簿の Client（ブラウザと同じもの）で呼ぶ。
 */
export const apiAs = async (email: string, password = DEV_PASSWORD) => {
  // サーバーが認証の期限を縮めている（AUTH_MAX_AGE_SECONDS）ので、少し経ったら取り直す
  let token = await idTokenFor(email, password);
  let issuedAt = Date.now();
  const bearer = async () => {
    if (Date.now() - issuedAt > TOKEN_REUSE_MS) {
      token = await idTokenFor(email, password);
      issuedAt = Date.now();
    }
    return `Bearer ${token}`;
  };
  const api = createClient(endpoints, {
    baseUrl: "http://localhost:3000/api",
    headers: async () => ({ authorization: await bearer() }),
  });
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`http://localhost:3000/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: await bearer() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  return { api, post };
};

/** API を直接呼ぶテストで、ID トークンを使い回す時間 */
const TOKEN_REUSE_MS = 5_000;

/** E2E でサーバーに設定する、認証の期限（playwright.config.ts の webServer） */
export const AUTH_MAX_AGE_SECONDS = 20;

/**
 * ブラウザの WebSocket を包み、テストから Realtime の接続を数えたり、切ったり、
 * つながり直すのを止めたりできるようにする（`page.addInitScript` に渡す）。
 * ネットワークを止めても、開いている WebSocket は閉じないため。
 */
export const controlRealtimeSockets = () => {
  const NativeWebSocket = window.WebSocket;
  const sockets: WebSocket[] = [];
  const control = { blocked: false, opened: 0, authSent: 0 };
  class ControlledWebSocket extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const isRealtime = String(url).includes("/api/realtime");
      // 止めている間は、存在しないポートにつなぐ（すぐに失敗し、Client が再試行する）
      super(isRealtime && control.blocked ? "ws://127.0.0.1:9/blocked" : url, protocols);
      if (isRealtime && !control.blocked) {
        control.opened += 1;
        sockets.push(this);
      }
    }
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (typeof data === "string" && data.includes('"type":"auth"')) control.authSent += 1;
      super.send(data);
    }
  }
  window.WebSocket = ControlledWebSocket as typeof WebSocket;
  Object.assign(window, {
    __realtime: {
      control,
      disconnect: () => {
        control.blocked = true;
        for (const s of sockets.splice(0)) s.close();
      },
      allow: () => {
        control.blocked = false;
      },
    },
  });
};

export type RealtimeControl = {
  control: { opened: number; authSent: number };
  disconnect(): void;
  allow(): void;
};

/** `controlRealtimeSockets` の数（つないだ回数、送った auth メッセージの数） */
export const realtimeCounts = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __realtime: RealtimeControl }).__realtime.control,
  );

const idTokenFor = async (email: string, password: string) => {
  const cognito = new CognitoIdentityProviderClient({
    endpoint: process.env.COGNITO_ENDPOINT ?? "http://localhost:5050",
    region: "ap-northeast-1",
    credentials: { accessKeyId: "magnito-access-key", secretAccessKey: "magnito-secret-key" },
  });
  const res = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID ?? "survey-web",
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );
  return res.AuthenticationResult!.IdToken!;
};

/** alice がオーナー、bob がメンバー、vic が閲覧者のワークスペースを作る */
export const setupWorkspace = async () => {
  const alice = await apiAs("alice@example.com");
  const { workspaceId } = await alice.post<{ workspaceId: string }>("/workspaces", {
    workspace: { name: unique("WS") },
    ownerDisplayName: "Alice",
    members: [
      { displayName: "Bob", email: "bob@example.com", role: "member" },
      { displayName: "Vic", email: "vic@example.com", role: "viewer" },
    ],
  });
  return { alice, workspaceId };
};
