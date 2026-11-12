/**
 * revocations：メンバーが変わったら、その人の Realtime の接続の認証コンテキストを、すべての台で作り直す。
 *
 * - 書く側：Repository の変更で Member が変わったら（追加・ロールの変更・削除）、revocations に 1 件書く
 * - 受ける側：各台が revocations を購読し、届いたらその人の接続を `revalidate` する。
 *   外された人の開いている一覧は FORBIDDEN で止まり、ロールが変わった人は新しいロールで続く
 *
 * 書いた台も自分の購読で受け取るので、台の数によらず同じ経路になる。
 * これを使わなければ、認証コンテキストの期限（最長 5 分）までは古い権限のまま使える。
 */
import {
  subscribeOnServer,
  type ChangeRecord,
  type RealtimeTransport,
} from "@zodapp/zod-dynamodb";
import type { RealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { endpoints, revocationOf, revocationOps, type Auth } from "../shared";
import type { AppRepository } from "./repository";

/** 変更のうち、メンバーが変わった人のメールアドレス（小文字） */
export const changedMembers = (changes: readonly ChangeRecord[]): string[] => [
  ...new Set(
    changes
      .filter((c) => c.entity === "Member")
      .map((c) => String(c.key.email).toLowerCase()),
  ),
];

/** メンバーが変わった人の revoke を書く */
export const writeRevocations = async (
  repository: AppRepository,
  emails: readonly string[],
) => {
  await Promise.all(
    emails.map((email) => {
      const { key, item } = revocationOf(email);
      return repository.revocations.set(key, item);
    }),
  );
};

/** revocations を購読し、届いた人の接続を作り直す */
export const subscribeRevocations = (options: {
  transport: RealtimeTransport;
  prefix: string;
  realtime: Pick<RealtimeGateway, "revalidate">;
}) =>
  subscribeOnServer({
    endpoints,
    transport: options.transport,
    prefix: options.prefix,
    op: revocationOps.recent,
    params: {},
    onChange: async ({ type, item }) => {
      if (type === "REMOVED") return; // TTL で消えただけ
      await options.realtime.revalidate(
        (ctx: Auth) => ctx.email.toLowerCase() === item.email,
      );
    },
    onError: (error) => console.error("[revocations]", error),
  });
