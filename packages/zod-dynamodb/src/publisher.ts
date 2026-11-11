/**
 * 書き込み側の発行（§9.3、§11）。Repository の `ChangeListener` として、変更をトピックに発行する。
 * 配送の実装（`RealtimeTransport`）によらない部分。
 */
import type { BatchMarker, ChangeListener, ChangeRecord } from "./events";
import type { ResolvedEntry } from "./register";
import type { AnySubscriptionDef } from "./subscription";
import type { AnyTableConfig } from "./table";
import {
  publishedFields,
  topicMessageCodec,
  topicsForChange,
  topicsForScope,
  type RealtimeTransport,
  type TopicOptions,
} from "./topics";

/** 発行の失敗（§9.4）。書き込み自体は成功している（§11.3） */
export type PublishError = {
  readonly error: unknown;
  /** 発行しようとしたトピック。メッセージの組み立てで失敗したときは `undefined` */
  readonly topic: string | undefined;
  readonly change?: ChangeRecord;
  readonly marker?: BatchMarker;
};

/** AWS IoT Core のメッセージの大きさの上限 */
export const DEFAULT_MAX_MESSAGE_BYTES = 128 * 1024;

export type ChangePublisherOptions = TopicOptions & {
  transport: RealtimeTransport;
  /** 公開する Subscription。この Subscription が使う Index のトピックだけに発行する */
  subscriptions?:
    | readonly AnySubscriptionDef[]
    | Readonly<Record<string, AnySubscriptionDef>>;
  /** 登録簿。`live` を付けたクエリを、公開する Subscription として使う（`subscriptions` の代わり） */
  endpoints?: { readonly entries: readonly ResolvedEntry[] };
  /** メッセージの大きさの上限（バイト）。超えたら発行せず `onPublishError` に渡す。既定は 128KB */
  maxMessageBytes?: number;
  /** 発行の失敗。既定は `console.error` に出す */
  onPublishError?: (error: PublishError) => void;
};

export type ChangePublisher = ChangeListener & {
  /** 配送の接続を閉じる */
  close(): Promise<void>;
};

type Route = {
  table: AnyTableConfig;
  index: string | undefined;
  codec: ReturnType<typeof topicMessageCodec>;
};

export class MessageTooLargeError extends Error {
  constructor(
    readonly bytes: number,
    readonly maxBytes: number,
  ) {
    super(`message is ${bytes} bytes, exceeding ${maxBytes} bytes`);
    this.name = "MessageTooLargeError";
  }
}

/**
 * 変更を、Subscription が使う Index のトピックに発行する `ChangeListener` を作る（§9.3）。
 * 同じ Index のトピックには、変更ごとに 1 回だけ発行する（フィールドは、その Index の Subscription の和に絞る）。
 */
export const createChangePublisher = (
  options: ChangePublisherOptions,
): ChangePublisher => {
  const subs: readonly AnySubscriptionDef[] = [
    ...(Array.isArray(options.subscriptions)
      ? (options.subscriptions as readonly AnySubscriptionDef[])
      : Object.values(options.subscriptions ?? {})),
    ...(options.endpoints?.entries ?? []).flatMap((e) =>
      e.subscription ? [e.subscription] : [],
    ),
  ];
  const maxBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  const report =
    options.onPublishError ??
    ((e: PublishError) => console.error("zod-dynamodb: publish failed", e));
  const topicOptions = { prefix: options.prefix };

  // エンティティごとの、Index ごとの発行先
  const routes = new Map<string, Route[]>();
  const grouped = new Map<string, AnySubscriptionDef[]>();
  for (const sub of subs) {
    const key = `${sub.table._compiled.entity}\n${sub.query.index ?? ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), sub]);
  }
  for (const group of grouped.values()) {
    const { table, query } = group[0]!;
    const entity = table._compiled.entity;
    const fields = publishedFields(table, query.index, group);
    routes.set(entity, [
      ...(routes.get(entity) ?? []),
      {
        table,
        index: query.index,
        codec: topicMessageCodec(table, fields),
      },
    ]);
  }

  const publish = async (
    topics: readonly string[],
    message: string,
    context: Pick<PublishError, "change" | "marker">,
  ) => {
    const bytes = new TextEncoder().encode(message).length;
    if (bytes > maxBytes) {
      for (const topic of topics) {
        report({
          error: new MessageTooLargeError(bytes, maxBytes),
          topic,
          ...context,
        });
      }
      return;
    }
    await Promise.all(
      topics.map((topic) =>
        options.transport
          .publish(topic, message)
          .catch((error: unknown) => report({ error, topic, ...context })),
      ),
    );
  };

  const each = async <T>(
    items: readonly T[],
    run: (item: T) => Promise<void>,
    context: (item: T) => Pick<PublishError, "change" | "marker">,
  ) => {
    await Promise.all(
      items.map((item) =>
        run(item).catch((error: unknown) =>
          report({ error, topic: undefined, ...context(item) }),
        ),
      ),
    );
  };

  return {
    onChanges: (changes) =>
      each(
        changes.flatMap((change) =>
          (routes.get(change.entity) ?? []).map((route) => ({
            change,
            route,
          })),
        ),
        async ({ change, route }) => {
          const topics = await topicsForChange(
            route.table,
            route.index,
            change,
            topicOptions,
          );
          if (topics.length === 0) return;
          await publish(topics, route.codec.encodeChange(change), { change });
        },
        ({ change }) => ({ change }),
      ),
    onBatchMarker: (marker) =>
      each(
        routes.get(marker.entity) ?? [],
        async (route) => {
          const topics = await topicsForScope(
            route.table,
            route.index,
            marker.scope,
            topicOptions,
          );
          if (topics.length === 0) return;
          await publish(topics, route.codec.encodeBatch(marker), { marker });
        },
        () => ({ marker }),
      ),
    close: () => options.transport.close(),
  };
};
