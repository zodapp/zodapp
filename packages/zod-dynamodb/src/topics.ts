/**
 * リアルタイムの配送（§9.3、§11）：トピックの導出、配送のインターフェース、トピックに流すメッセージの形式。
 * 書き込み側（Publisher）と Gateway で共有する。
 */
import { jsonTransport } from "./json-transport";
import { z } from "zod";
import { DefinitionError } from "./errors";
import type { BatchMarker, ChangeRecord, WriteOrigin } from "./events";
import { composeKey, type KeyPart } from "./keys";
import { narrowItemSchema } from "./narrow";
import type { AnySubscriptionDef } from "./subscription";
import type { AnyTableConfig } from "./table";

// ---- トピック ----

export const DEFAULT_TOPIC_PREFIX = "zod-dynamodb";

/** ベーステーブルのキーで検索するクエリのトピックに使う、予約の Index 名 */
export const PRIMARY_INDEX_TOPIC = "_primary";

export type TopicOptions = {
  /** トピック名の先頭。既定は `zod-dynamodb` */
  prefix?: string;
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const sha256 = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return toBase64Url(new Uint8Array(digest));
};

/**
 * トピック名（K7）：`{prefix}/{エンティティ}/{Index 名}/{ハッシュ}`。
 * ハッシュの入力は、Partition Key と Sort Key の等値の部分（いずれも物理キーの文字列）。
 */
const topicName = async (
  table: AnyTableConfig,
  index: string | undefined,
  pk: string,
  eq: string,
  options: TopicOptions | undefined,
): Promise<string> => {
  const prefix = options?.prefix ?? DEFAULT_TOPIC_PREFIX;
  const entity = encodeURIComponent(table._compiled.entity);
  const indexName = encodeURIComponent(index ?? PRIMARY_INDEX_TOPIC);
  return `${prefix}/${entity}/${indexName}/${await sha256(`${pk}\n${eq}`)}`;
};

const indexParts = (
  table: AnyTableConfig,
  index: string | undefined,
): { partition: KeyPart; sort: KeyPart } => {
  const compiled = table._compiled;
  if (index === undefined) return compiled.key;
  const idx = compiled.indexes.get(index);
  if (!idx) {
    throw new DefinitionError(
      `entity "${compiled.entity}": unknown index "${index}"`,
    );
  }
  return idx;
};

/**
 * 購読者が購読するトピックを 1 つ求める（§9.3）。
 * 購読の条件（名前付きクエリのキー条件）の、Partition Key と Sort Key の等値の部分から決まる。
 */
export const topicForSubscriber = async (
  sub: AnySubscriptionDef,
  params: unknown,
  ctx: unknown,
  options?: TopicOptions,
): Promise<string> => {
  const cond = sub.query.condition(params, ctx);
  return topicName(sub.table, cond.indexName, cond.pk, cond.eq, options);
};

/**
 * Item が入るトピックをすべて求める（§9.3）。等値の部分の長さ（0 から Sort Key のフィールド数まで）
 * ごとに 1 つ。Item がその Index に入らない（sparse index）なら空。
 */
export const topicsForItem = async (
  table: AnyTableConfig,
  index: string | undefined,
  item: Record<string, unknown>,
  options?: TopicOptions,
): Promise<string[]> => {
  const entity = table._compiled.entity;
  const { partition, sort } = indexParts(table, index);
  const pk = composeKey(entity, partition, item);
  if (pk === undefined || composeKey(entity, sort, item) === undefined) {
    return [];
  }
  const topics: string[] = [];
  for (let k = 0; k <= sort.fields.length; k++) {
    const eq = composeKey(
      entity,
      { fields: sort.fields.slice(0, k), encoders: sort.encoders.slice(0, k) },
      item,
    )!;
    topics.push(await topicName(table, index, pk, eq, options));
  }
  return topics;
};

/** 変更の Before と After の両方から、Item が入るトピックを重複なく求める（§9.3） */
export const topicsForChange = async (
  table: AnyTableConfig,
  index: string | undefined,
  change: Pick<ChangeRecord, "before" | "after">,
  options?: TopicOptions,
): Promise<string[]> => {
  const topics = new Set<string>();
  for (const item of [change.before, change.after]) {
    if (item) {
      for (const t of await topicsForItem(table, index, item, options)) {
        topics.add(t);
      }
    }
  }
  return [...topics];
};

/**
 * 一括での書き込みの範囲（`scope`）から決まるトピックを求める（§11.5）。
 * 範囲が Partition Key のフィールドをすべて含む Index について、範囲が含む Sort Key の先頭のフィールドの数まで。
 * 範囲から Partition Key が決まらない Index では空。
 */
export const topicsForScope = async (
  table: AnyTableConfig,
  index: string | undefined,
  scope: Record<string, unknown>,
  options?: TopicOptions,
): Promise<string[]> => {
  const entity = table._compiled.entity;
  const { partition, sort } = indexParts(table, index);
  const pk = composeKey(entity, partition, scope);
  if (pk === undefined) return [];
  const topics: string[] = [];
  for (let k = 0; k <= sort.fields.length; k++) {
    const eq = composeKey(
      entity,
      { fields: sort.fields.slice(0, k), encoders: sort.encoders.slice(0, k) },
      scope,
    );
    if (eq === undefined) break;
    topics.push(await topicName(table, index, pk, eq, options));
  }
  return topics;
};

// ---- 配送 ----

/**
 * 配送のインターフェース（§9.4）。MQTT などの実装がこれを満たす。
 * メッセージは文字列（JSON）。1 つのトピックに登録できるハンドラーは 1 つ。
 */
export type RealtimeTransport = {
  publish(topic: string, message: string): Promise<void>;
  /** 購読を始める。配送基盤が購読を受け付けた（MQTT の SUBACK）ところで解決する */
  subscribe(topic: string, handler: (message: string) => void): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
  close(): Promise<void>;
};

// ---- トピックに流すメッセージ ----

/** トピックに流すメッセージを戻したもの。Item はフィールドを絞っていることがある */
export type TopicMessage =
  | {
      readonly type: "change";
      readonly entity: string;
      readonly key: Record<string, unknown>;
      readonly before: Record<string, unknown> | null;
      readonly after: Record<string, unknown> | null;
      readonly version: number;
      readonly origin: WriteOrigin;
    }
  | { readonly type: "batch"; readonly marker: BatchMarker };

const originSchema = z.object({
  kind: z.enum(["single", "transaction", "batch"]),
  id: z.string(),
});

/**
 * Table ごとの、トピックに流すメッセージの変換。
 * 書き込み側は `fields` に絞って変換し、Gateway はキー以外を省略できるものとして戻す。
 */
export const topicMessageCodec = (
  table: AnyTableConfig,
  fields?: ReadonlySet<string>,
) => {
  const compiled = table._compiled;
  const encodeItem = jsonTransport(
    fields ? narrowItemSchema(table.item, { keep: fields }) : table.item,
  );
  const decodeItem = jsonTransport(
    narrowItemSchema(table.item, { required: new Set(compiled.keyFields) }),
  );
  const key = jsonTransport(compiled.keySchema);
  const envelope = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("change"),
      entity: z.literal(compiled.entity),
      key: z.unknown(),
      before: z.unknown(),
      after: z.unknown(),
      version: z.number(),
      origin: originSchema,
    }),
    z.object({
      type: z.literal("batch"),
      marker: z.looseObject({
        type: z.enum(["BATCH_STARTED", "BATCH_FINISHED"]),
        entity: z.literal(compiled.entity),
        origin: originSchema,
      }),
    }),
  ]);
  return {
    encodeChange: (change: ChangeRecord): string =>
      JSON.stringify({
        type: "change",
        entity: change.entity,
        key: key.encode(change.key),
        before:
          change.before === null ? null : encodeItem.encode(change.before),
        after: change.after === null ? null : encodeItem.encode(change.after),
        version: change.version,
        origin: change.origin,
      }),
    encodeBatch: (marker: BatchMarker): string =>
      JSON.stringify({ type: "batch", marker }),
    /** 形が合わないメッセージは例外を投げる */
    decode: (message: string): TopicMessage => {
      const m = envelope.parse(JSON.parse(message));
      if (m.type === "batch") {
        return { type: "batch", marker: m.marker as unknown as BatchMarker };
      }
      const item = (json: unknown) =>
        json === null
          ? null
          : (decodeItem.decode(json) as Record<string, unknown>);
      return {
        type: "change",
        entity: m.entity,
        key: key.decode(m.key) as Record<string, unknown>,
        before: item(m.before),
        after: item(m.after),
        version: m.version,
        origin: m.origin,
      };
    },
  };
};

/**
 * 同じ Index を使う Subscription に必要なフィールドの和（§9.3）。トピックは Index ごとに共有するので、
 * 書き込み側はこの和に絞って発行し、Gateway が Subscription ごとに絞る。
 * Index のキーのフィールド（所属判定に使う）は常に含める。どれかがすべてのフィールドを使うなら `undefined`。
 */
export const publishedFields = (
  table: AnyTableConfig,
  index: string | undefined,
  subscriptions: readonly AnySubscriptionDef[],
): ReadonlySet<string> | undefined => {
  const fields = new Set<string>(table._compiled.keyFields);
  const parts = indexParts(table, index);
  for (const f of [...parts.partition.fields, ...parts.sort.fields]) {
    fields.add(f);
  }
  for (const sub of subscriptions) {
    if (!sub.fields) return undefined;
    for (const f of sub.fields) fields.add(f);
  }
  return fields;
};

/**
 * プロセス内の配送（テストと、1 プロセスで動かす開発用）。発行は同じインスタンスの購読者に届く。
 */
export const memoryTransport = (): RealtimeTransport & {
  /** 発行したメッセージの記録 */
  readonly published: { topic: string; message: string }[];
} => {
  const handlers = new Map<string, (message: string) => void>();
  const published: { topic: string; message: string }[] = [];
  return {
    published,
    publish: async (topic, message) => {
      published.push({ topic, message });
      const handler = handlers.get(topic);
      if (handler) queueMicrotask(() => handler(message));
    },
    subscribe: async (topic, handler) => {
      handlers.set(topic, handler);
    },
    unsubscribe: async (topic) => {
      handlers.delete(topic);
    },
    close: async () => {
      handlers.clear();
    },
  };
};
