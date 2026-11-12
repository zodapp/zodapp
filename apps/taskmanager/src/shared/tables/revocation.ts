import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { appTable, TTL_ATTRIBUTE } from "../table";
import { createOps } from "../context";

/** revoke の Item が消えるまでの秒数。認証コンテキストの寿命の最長（5 分）と同じ */
export const REVOCATION_TTL_SECONDS = 5 * 60;

/** すべての revoke を 1 つのトピックで配るための、固定のパーティション */
const SCOPE = "all";

/**
 * 「誰の権限が変わったか」。メンバーが変わったら（追加・ロールの変更・削除）、サーバーが 1 件書く。
 * 各台はこれを購読し、その人の Realtime の接続の認証コンテキストを作り直す（src/server/revocations.ts）。
 *
 * 名前は revocations だが、権限が増えた場合（追加・ロールを上げた）にもすぐ効く。
 * 書かなければ、認証コンテキストの期限（最長 5 分）までは、古い権限のまま使える。
 */
export const revocations = tableConfig({
  table: appTable,
  entity: "Revocation",
  item: z.object({
    scope: z.literal(SCOPE),
    /** 対象のメールアドレス（小文字） */
    email: z.string(),
    /** ミリ秒の時刻 */
    revokedAt: z.number(),
    /** DynamoDB の TTL（秒の時刻） */
    [TTL_ATTRIBUTE]: z.number(),
  }),
  create: z.object({
    revokedAt: z.number(),
    [TTL_ATTRIBUTE]: z.number(),
  }),
  // メールアドレスをパーティションにすると、トピックが人ごとに分かれ、各台が全員分を受け取れない
  key: { partition: ["scope"], sort: ["email"] },
});

export const revocationOps = createOps(revocations, (o) => ({
  /** すべての revoke。サーバー専用（authorize なし）。各台が subscribeOnServer で購読する */
  recent: o.query({
    params: z.object({}),
    where: () => ({ partition: { scope: SCOPE } }),
  }),
}));

/** revoke の 1 件（サーバーが `set` で書く。同じ人がまた変われば上書きする） */
export const revocationOf = (email: string, now = Date.now()) => {
  const key = { scope: SCOPE, email: email.toLowerCase() } as const;
  return {
    key,
    item: {
      ...key,
      revokedAt: now,
      [TTL_ATTRIBUTE]: Math.floor(now / 1000) + REVOCATION_TTL_SECONDS,
    },
  };
};
