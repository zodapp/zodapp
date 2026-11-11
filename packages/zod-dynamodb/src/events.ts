import type { QueryDef } from "./query";

/** 書き込み元（§11.5） */
export type WriteOrigin = {
  readonly kind: "single" | "transaction" | "batch";
  readonly id: string;
};

/**
 * 1件のItemの変更。Repositoryの書き込みから作る（ラッパー方式。§11.1）。
 * `before` / `after` はitemのSchemaでparseした値で、物理キーやライブラリ管理属性を含まない。
 */
export type ChangeRecord<TItem = Record<string, unknown>> = {
  /** Table定義のエンティティ名 */
  readonly entity: string;
  readonly key: Record<string, unknown>;
  /** 書き込み前のItem。作成では `null` */
  readonly before: TItem | null;
  /** 書き込み後のItem。削除では `null` */
  readonly after: TItem | null;
  /** 書き込み後の `version`。削除では書き込み前の `version` + 1 */
  readonly version: number;
  readonly origin: WriteOrigin;
};

/** 一括での書き込みの開始・終了（§11.5） */
export type BatchMarker =
  | {
      readonly type: "BATCH_STARTED";
      readonly origin: WriteOrigin;
      readonly entity: string;
      /** 書き込みの範囲（`HASH` の範囲など） */
      readonly scope: Record<string, unknown>;
    }
  | {
      readonly type: "BATCH_FINISHED";
      readonly origin: WriteOrigin;
      readonly entity: string;
      readonly scope: Record<string, unknown>;
      readonly count: number;
      readonly status: "completed" | "aborted";
    };

/**
 * 変更の受け取り手。配送実装（MQTTなど）はこのインターフェースを実装する。
 * ラッパー方式とStreams方式を切り替えられるよう、イベントの発行はここで分離する（§11.4）。
 */
export type ChangeListener = {
  onChanges?(changes: readonly ChangeRecord[]): void | Promise<void>;
  onBatchMarker?(marker: BatchMarker): void | Promise<void>;
};

export type SubscriptionEventType = "ADDED" | "MODIFIED" | "REMOVED";

/**
 * 名前付きクエリの所属判定から、購読者に配るイベントの種類を決める（§11.2）。
 * 配信不要なら `undefined`。
 */
export const classifyChange = <TParams>(
  query: QueryDef<any, any, any, any>,
  params: TParams,
  change: Pick<ChangeRecord, "before" | "after">,
  ctx?: unknown,
): SubscriptionEventType | undefined => {
  const wasIn =
    change.before !== null && query.matches(change.before, params, ctx);
  const isIn =
    change.after !== null && query.matches(change.after, params, ctx);
  if (!wasIn && isIn) return "ADDED";
  if (wasIn && isIn) return "MODIFIED";
  if (wasIn && !isIn) return "REMOVED";
  return undefined;
};
