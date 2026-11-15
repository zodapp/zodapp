import { getResolverContextSlice } from "../resolverContext/runtime";
import type { BaseExternalKeyConfig, ExternalKeyResolverEntry } from "./types";

/**
 * モックの選択肢。`label` と `value` のほかに、`filter` で使う項目（部署など）を持たせてよい。
 * 欄に届けるのは `label` と `value` だけ
 */
export type MockExternalKeyOption = {
  label: string;
  value: string;
  [field: string]: unknown;
};

/**
 * 値を一つ持ち、変更を購読者に届けるだけのオブジェクト（pub/sub）。
 * モックの resolver の出どころとして使う。データの作り方や更新の仕方は使う側が決める
 */
export type MockTopic<T> = {
  /** 今の値 */
  get: () => T;
  /** 値を変え、購読者全員に届ける。関数を渡すと今の値から作る */
  set: (next: T | ((prev: T) => T)) => void;
  /** 値が変わるたびに listener を呼ぶ。戻り値で購読をやめる */
  subscribe: (listener: (value: T) => void) => () => void;
};

export const createMockTopic = <T>(initial: T): MockTopic<T> => {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set: (next) => {
      value =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      for (const listener of [...listeners]) listener(value);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * モックの externalKey の config。
 *
 * - `topic`: 選択肢の出どころ（`createMockExternalKeyResolver` の `topics` のキー）。
 *   親の値で選択肢を変えるときは、`cities/${prefecture}` のように名前に値を入れる
 * - `delayMs`: 最初の選択肢を返すまでの待ち時間。読み込み中の表示を見るため
 * - `contextId`: `filter` に渡す resolverContext の部分
 * - `filter`: 届いた選択肢の絞り込み。`contextId` の resolverContext を第 2 引数で受け取る
 *   （実際の resolver の filter と同じ形）。context の値が変わると取り直す
 */
export type MockExternalKeyConfig<
  TType extends string = "mock",
  TContext = unknown,
> = BaseExternalKeyConfig<TType> & {
  topic: string;
  delayMs?: number;
  contextId?: string;
  filter?: (option: MockExternalKeyOption, context: TContext) => boolean;
};

/**
 * ローカル開発用のモック externalKey resolver。
 * `delayMs` だけ待ってから topic の今の選択肢を返し、そのあとは topic が変わるたびに届け直す。
 * 無い topic は空の選択肢を一度返す。
 *
 * @example
 * const users = createMockTopic([{ label: "山田", value: "u1" }]);
 * createMockExternalKeyResolver({ topics: { users } });
 * // あとで users.set(...) すると、購読中の欄に新しい選択肢が届く
 */
export const createMockExternalKeyResolver = <
  TType extends string = "mock",
  TContext = unknown,
>({
  type = "mock" as TType,
  topics,
  delayMs: defaultDelayMs = 300,
}: {
  type?: TType;
  topics: Record<string, MockTopic<MockExternalKeyOption[]>>;
  delayMs?: number;
}): ExternalKeyResolverEntry<
  TType,
  MockExternalKeyConfig<TType, TContext>
> => ({
  type,
  resolver: (config, resolverContext) => ({
    subscribe: (callback) => {
      const topic = topics[config.topic];
      const context = getResolverContextSlice(
        resolverContext,
        config.contextId,
      ) as TContext;
      const { filter } = config;
      const deliver = (options: MockExternalKeyOption[]) =>
        callback(
          (filter
            ? options.filter((option) => filter(option, context))
            : options
          ).map(({ label, value }) => ({ label, value })),
        );
      let unsubscribeTopic: (() => void) | undefined;
      const timer = setTimeout(() => {
        if (!topic) {
          callback([]);
          return;
        }
        deliver(topic.get());
        unsubscribeTopic = topic.subscribe(deliver);
      }, config.delayMs ?? defaultDelayMs);
      return () => {
        clearTimeout(timer);
        unsubscribeTopic?.();
      };
    },
  }),
});
