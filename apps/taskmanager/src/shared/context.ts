import { defineContext } from "@zodapp/zod-dynamodb";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

/**
 * 認証コンテキスト。サーバーは ID トークンとメンバーの一覧から作り、
 * ブラウザはログインの後に自分の所属一覧を読んで作る（src/web/shared/auth）。
 */
export type Auth = {
  /** Cognito の sub */
  userId: string;
  email: string;
  /** ワークスペースごとのロール */
  roles: Readonly<Record<string, MemberRole>>;
  /**
   * 認証コンテキストの期限（ミリ秒の時刻）。サーバーだけが入れる（トークンの期限と、作ってから 5 分の早いほう）。
   * サーバーの API の `expiresAt` で、操作のたびに確かめる
   */
  expiresAt?: number;
};

/** ログインしていないリクエストの認証コンテキスト。すべての操作の認可で拒否される */
export const anonymous: Auth = { userId: "", email: "", roles: {} };

/**
 * 操作（createOps）、サーバーの上書き（override）、登録簿（defineEndpoints）は、すべてここから作る。
 * defineEndpoints は、この defineContext の操作だけを受け付ける（型と実行時の両方）
 */
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// ---- ロールの判定（zodapp の Firestore のセキュリティルールと同じ） ----

const roleOf = (ctx: Auth, workspaceId: string): MemberRole | undefined =>
  ctx.roles[workspaceId];

/** 閲覧：所属していること */
export const isMember = (ctx: Auth, workspaceId: string) =>
  roleOf(ctx, workspaceId) !== undefined;

/** タスクの書き込み：owner・admin・member */
export const canWriteTask = (ctx: Auth, workspaceId: string) => {
  const role = roleOf(ctx, workspaceId);
  return role === "owner" || role === "admin" || role === "member";
};

/** ワークスペース・プロジェクト・メンバーの管理：owner・admin */
export const isAdmin = (ctx: Auth, workspaceId: string) => {
  const role = roleOf(ctx, workspaceId);
  return role === "owner" || role === "admin";
};
