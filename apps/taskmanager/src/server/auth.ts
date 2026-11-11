/**
 * 認証：Cognito（ローカルでは magnito）の ID トークンを JWKS で検証し、
 * メンバーの一覧からロールを引いて認証コンテキストを作る。
 */
import type { IncomingMessage } from "node:http";
import { UnauthenticatedError } from "@zodapp/zod-dynamodb-node";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { anonymous, memberOps, type Auth } from "../shared";
import { config } from "./env";
import type { AppRepository } from "./repository";

export { UnauthenticatedError };

/**
 * 認証コンテキストの寿命の上限。Realtime Gateway は寿命の 8 割で作り直すので、
 * revalidate を呼び忘れても、ロールの古さはこの時間までに収まる
 */
export const CONTEXT_MAX_AGE_MS = 5 * 60_000;

const jwks = createRemoteJWKSet(
  new URL(`${config.cognito.issuer}/.well-known/jwks.json`),
);

/** Authorization ヘッダー、なければクエリ文字列の token（ブラウザの WebSocket はヘッダーを付けられない） */
export const tokenOf = (req: IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get("token") ?? undefined;
};

export const verifyIdToken = async (token: string) => {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.cognito.issuer,
    audience: config.cognito.clientId,
  });
  if (payload.token_use !== "id" || typeof payload.email !== "string") {
    throw new UnauthenticatedError("an ID token with an email is required");
  }
  // 期限は、トークンの exp と、発行から AUTH_MAX_AGE_SECONDS の早いほう（E2E で期限を短くするため）
  const exp = (payload.exp ?? Infinity) * 1000;
  const maxAge = config.auth.maxAgeSeconds;
  const expiresAt =
    maxAge && payload.iat !== undefined
      ? Math.min(exp, (payload.iat + maxAge) * 1000)
      : exp;
  return {
    userId: String(payload.sub),
    email: payload.email.toLowerCase(),
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
};

/**
 * ID トークンから認証コンテキストを作る（サーバーの API の `context`）。HTTP の router、
 * Realtime Gateway の接続・`auth` メッセージ・`revalidate` で共有する。
 * トークンがなければ匿名、正しくなければ `UnauthenticatedError`（401）。
 */
export const createAuthContext =
  (repository: AppRepository) =>
  async (token: string | undefined): Promise<Auth> => {
    if (!token) return anonymous;
    let user: Awaited<ReturnType<typeof verifyIdToken>>;
    try {
      user = await verifyIdToken(token);
    } catch (error) {
      throw error instanceof UnauthenticatedError
        ? error
        : new UnauthenticatedError("invalid token", { cause: error });
    }
    const { expiresAt: tokenExpiresAt, ...identity } = user;
    // ロールは、コンテキストを作るときにメンバーの一覧から引く。
    // HTTP ではリクエストのたび、Realtime では接続・トークンの入れ替え・revalidate・期限の前の作り直しのとき
    const roles = await loadRoles(repository, identity);
    // コンテキストの期限は、トークンの期限と「作ってから 5 分」の早いほう
    const expiresAt = Math.min(
      tokenExpiresAt ?? Infinity,
      Date.now() + CONTEXT_MAX_AGE_MS,
    );
    return { ...identity, roles, expiresAt };
  };

/** 認証コンテキストの期限（サーバーの API の `expiresAt`）。匿名は期限なし */
export const authExpiresAt = (ctx: Auth) => ctx.expiresAt;

/** Realtime の `auth` メッセージ（`{ token }`）から、ID トークンを取り出す */
export const tokenOfMessage = (payload: unknown): string =>
  z.object({ token: z.string().min(1) }).parse(payload).token;

/** 利用者のワークスペースごとのロールを、メンバーの email の Index から引く */
export const loadRoles = async (
  repository: AppRepository,
  user: { userId: string; email: string },
): Promise<Auth["roles"]> => {
  const roles: Record<string, Auth["roles"][string]> = {};
  let cursor: string | undefined;
  do {
    const page = await repository.members.query(
      memberOps.mine,
      {},
      { context: { ...user, roles: {} }, cursor },
    );
    for (const m of page.items) roles[m.workspaceId] = m.role;
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return roles;
};
