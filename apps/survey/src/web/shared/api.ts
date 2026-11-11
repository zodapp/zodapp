/**
 * ブラウザの API。登録簿（src/shared/endpoints）から作る。
 * HTTP には ID トークンを Authorization で、リアルタイムの接続にはクエリ文字列で付ける。
 */
import { fetchAuthSession } from "aws-amplify/auth";
import { createClient } from "@zodapp/zod-dynamodb-client";
import { endpoints } from "../../shared";
import "./amplify";

type IdToken = NonNullable<NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["idToken"]>;

/**
 * サーバーが認証の期限を縮めているとき（E2E。サーバーの AUTH_MAX_AGE_SECONDS）の秒数。
 * 期限の計算をサーバー（auth.ts の verifyIdToken）と揃える
 */
const maxAgeSeconds = Number(import.meta.env.VITE_AUTH_MAX_AGE_SECONDS) || undefined;

/** トークンを使える期限（ミリ秒の時刻）と、その何ミリ秒前に取り直すか */
const lifetimeOf = (token: IdToken) => {
  const { exp = Infinity, iat = 0 } = token.payload;
  const usableUntil = Math.min(exp * 1000, maxAgeSeconds ? (iat + maxAgeSeconds) * 1000 : Infinity);
  // 期限の 1 分前。寿命が短いときは、寿命の 3 分の 1 の前
  const margin = Math.min(60_000, (usableUntil - iat * 1000) / 3);
  return { usableUntil, margin };
};

let refreshing: Promise<IdToken | undefined> | undefined;

/** 期限が近ければ取り直した ID トークン。ログインしていなければ undefined */
const currentIdToken = async (): Promise<IdToken | undefined> => {
  const token = (await fetchAuthSession()).tokens?.idToken;
  if (!token) return undefined;
  const { usableUntil, margin } = lifetimeOf(token);
  if (usableUntil - Date.now() > margin) return token;
  // 同時に呼ばれても、取り直しは 1 回だけ
  refreshing ??= fetchAuthSession({ forceRefresh: true })
    .then((s) => s.tokens?.idToken)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
};

export const getIdToken = async (): Promise<string | undefined> => {
  const token = await currentIdToken();
  scheduleRealtimeAuth(token);
  return token?.toString();
};

// ---- Realtime の接続のトークンの入れ替え ----
// 期限が来る前にトークンを取り直し、`auth` メッセージで送る。接続はつなぎ直さない

let scheduled: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

const scheduleRealtimeAuth = (token: IdToken | undefined) => {
  const value = token?.toString();
  if (value === scheduled) return;
  const previous = scheduled;
  scheduled = value;
  clearTimeout(timer);
  timer = undefined;
  if (!token || !value) return;
  // HTTP の呼び出しなどで新しいトークンになったら、すぐに接続へも送る
  if (previous) api.realtime.authenticate({ token: value });
  const { usableUntil, margin } = lifetimeOf(token);
  // 取り直す時刻を少し過ぎてから呼ぶ（その時刻ちょうどだと、まだ取り直さないことがある）
  timer = setTimeout(
    () => void getIdToken(),
    Math.max(0, usableUntil - margin - Date.now() + 500),
  );
};

const realtimeUrl = async () => {
  const base = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/realtime`;
  const token = await getIdToken();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
};

export const api = createClient(endpoints, {
  baseUrl: "/api",
  headers: async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
  realtime: { url: realtimeUrl },
});

export type Api = typeof api;

/** 登録簿に載せないサーバーのルート（/api/workspaces など）を呼ぶ */
export const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
  const token = await getIdToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
};

export const getJson = async <T,>(path: string): Promise<T> => {
  const token = await getIdToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
};
