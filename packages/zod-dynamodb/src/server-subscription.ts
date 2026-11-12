/**
 * サーバーのコードが、live を付けたクエリを購読する補助（§9）。
 * 配送（`RealtimeTransport`）のトピックを購読し、クエリの範囲に入る変更だけを渡す。
 * Node に依存しないので、どの実行環境でも使える。
 */
import type { z } from "zod";
import { DefinitionError } from "./errors";
import {
  classifyChange,
  type SubscriptionEventType,
  type WriteOrigin,
} from "./events";
import { pickFields } from "./endpoint";
import type { QueryOp } from "./ops";
import type { ResolvedEntry } from "./register";
import type { AnyTableConfig, ItemOf, TableKey } from "./table";
import {
  topicForSubscriber,
  topicMessageCodec,
  type RealtimeTransport,
  type TopicOptions,
} from "./topics";

/** サーバーでの購読に届く変更 1 件 */
export type ServerChangeEvent<T extends AnyTableConfig = AnyTableConfig> = {
  readonly type: SubscriptionEventType;
  readonly key: TableKey<T>;
  /**
   * ADDED と MODIFIED なら変更のあとの Item、REMOVED なら変更の前の Item。
   * live に `fields` を指定したときは、そのフィールド（と Index のキー）だけを持つ
   */
  readonly item: ItemOf<T>;
  readonly before: ItemOf<T> | null;
  readonly after: ItemOf<T> | null;
  readonly version: number;
  readonly origin: WriteOrigin;
};

export type SubscribeOnServerOptions<
  O extends QueryOp<any, any, any, any, any, any>,
> = TopicOptions & {
  /** 登録簿。`op` の live の指定（`fields`）を引く */
  endpoints: { entryOf(op: unknown): ResolvedEntry | undefined };
  /**
   * 配送。1 つのトピックにハンドラーを 1 つしか持てないので、Realtime Gateway とは別の接続を推奨する
   * （Gateway が同じトピックを購読すると、どちらかに届かなくなる）
   */
  transport: RealtimeTransport;
  /** live を付けたクエリ（サーバー専用でも、そうでなくてもよい） */
  op: O;
  params: z.input<O["params"]>;
  /** 範囲が認証コンテキストで決まるクエリ（「自分の担当」など）のときの認証コンテキスト */
  context?: unknown;
  /** 範囲に入る変更。一括の書き込みの印は渡さない */
  onChange: (event: ServerChangeEvent<O["table"]>) => void | Promise<void>;
  /** 形の合わないメッセージや、`onChange` の失敗。既定は `console.error` に出す */
  onError?: (error: unknown) => void;
};

export type ServerSubscription = {
  /** 購読しているトピック */
  readonly topic: string;
  /** 配送の購読をやめる（配送そのものは閉じない） */
  close(): Promise<void>;
};

/** 同じ配送の上で、いま購読しているトピック（重ねて購読すると先のハンドラーが外れるため） */
const active = new WeakMap<RealtimeTransport, Set<string>>();

/**
 * live を付けたクエリを、サーバーのコードで購読する。配送基盤が購読を受け付けた（MQTT の SUBACK）ところで解決する。
 *
 * 最初のページは読まない（購読を始めたあとの変更だけを渡す）。今の状態が要るなら、Repository で読む。
 * 認可は行わない。
 *
 * ```ts
 * const sub = await subscribeOnServer({
 *   endpoints, transport, prefix: "app",
 *   op: revocationOps.recent, params: {},
 *   onChange: ({ item }) => realtime.revalidate((ctx) => ctx.email === item.email),
 * });
 * ```
 */
export const subscribeOnServer = async <
  O extends QueryOp<any, any, any, any, any, any>,
>(
  options: SubscribeOnServerOptions<O>,
): Promise<ServerSubscription> => {
  const { endpoints, transport, op, context } = options;
  const entry = endpoints.entryOf(op);
  const sub = entry?.subscription;
  if (!entry || !sub) {
    throw new DefinitionError(
      `subscribeOnServer: "${op.name}" is not a live query in the endpoints`,
    );
  }
  const report =
    options.onError ??
    ((error: unknown) =>
      console.error("zod-dynamodb: server subscription failed", error));
  const params = op.params.parse(options.params);
  const topic = await topicForSubscriber(sub, params, context, {
    prefix: options.prefix,
  });
  const topics = active.get(transport) ?? new Set<string>();
  active.set(transport, topics);
  if (topics.has(topic)) {
    throw new Error(
      `subscribeOnServer: topic "${topic}" is already subscribed on this transport`,
    );
  }
  const codec = topicMessageCodec(sub.table);
  const entity = sub.table._compiled.entity;
  const narrow = (item: Record<string, unknown> | null) =>
    item && sub.fields ? pickFields(item, sub.fields) : item;
  let closed = false;

  const handle = async (raw: string) => {
    if (closed) return;
    let message;
    try {
      message = codec.decode(raw);
    } catch (error) {
      // 別のエンティティのメッセージ（ハッシュの衝突）は黙って捨てる。形が合わないものは報告する
      if (entityOf(raw) === entity) report(error);
      return;
    }
    if (message.type !== "change") return;
    const type = classifyChange(op, params, message, context);
    if (!type) return;
    const before = narrow(message.before);
    const after = narrow(message.after);
    await options.onChange({
      type,
      key: message.key as never,
      item: (type === "REMOVED" ? before : after) as never,
      before: before as never,
      after: after as never,
      version: message.version,
      origin: message.origin,
    });
  };

  topics.add(topic);
  try {
    await transport.subscribe(topic, (raw) => {
      handle(raw).catch(report);
    });
  } catch (error) {
    topics.delete(topic);
    throw error;
  }
  return {
    topic,
    close: async () => {
      if (closed) return;
      closed = true;
      topics.delete(topic);
      await transport.unsubscribe(topic);
    },
  };
};

const entityOf = (raw: string): unknown => {
  try {
    return (JSON.parse(raw) as { entity?: unknown }).entity;
  } catch {
    return undefined;
  }
};
