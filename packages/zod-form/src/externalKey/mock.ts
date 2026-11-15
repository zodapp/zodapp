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
 * モックの resolver の出どころとして使う。データの作り方や更新の仕方は使う側が決める。
 * 初めの値を渡さずに作ると、最初の `set` まで値が無い
 */
export type MockTopic<T> = {
  /** 今の値。まだ値が無いときは undefined */
  get: () => T | undefined;
  /** 値があるか */
  has: () => boolean;
  /** 値を変え、購読者全員に届ける。関数を渡すと今の値から作る */
  set: (next: T | ((prev: T | undefined) => T)) => void;
  /** 値が変わるたびに listener を呼ぶ。今の値は届けない。戻り値で購読をやめる */
  subscribe: (listener: (value: T) => void) => () => void;
};

export function createMockTopic<T>(): MockTopic<T>;
export function createMockTopic<T>(initial: T): MockTopic<T>;
export function createMockTopic<T>(...args: [] | [T]): MockTopic<T> {
  let hasValue = args.length > 0;
  let value = args[0];
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    has: () => hasValue,
    set: (next) => {
      const nextValue =
        typeof next === "function"
          ? (next as (prev: T | undefined) => T)(value)
          : next;
      value = nextValue;
      hasValue = true;
      for (const listener of [...listeners]) listener(nextValue);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * モックの externalKey の config。
 *
 * - `topic`: 選択肢の出どころ（`createMockExternalKeyResolver` の `topics` のキー）。
 *   親の値で選択肢を変えるときは、`cities/${prefecture}` のように名前に値を入れる
 * - `contextId`: `filter` に渡す resolverContext の部分
 * - `filter`: 届いた選択肢の絞り込み。`contextId` の resolverContext を第 2 引数で受け取る
 *   （実際の resolver の filter と同じ形）。context の値が変わると取り直す
 */
export type MockExternalKeyConfig<
  TType extends string = "mock",
  TContext = unknown,
> = BaseExternalKeyConfig<TType> & {
  topic: string;
  contextId?: string;
  filter?: (option: MockExternalKeyOption, context: TContext) => boolean;
};

/**
 * ローカル開発用のモック externalKey resolver。
 * 届く時機は topic の `set` を呼ぶ側が決める。モックは待たない。
 *
 * - topic に値があれば、購読したその場で今の選択肢を届ける
 * - topic にまだ値が無ければ何も届けない（欄は読み込み中のまま）。最初の `set` で届ける
 * - そのあとは topic が変わるたびに届け直す
 * - 無い topic は、購読したその場で空の選択肢を一度届ける
 *
 * @example
 * const users = createMockTopic([{ label: "利用者 A", value: "u1" }]);
 * createMockExternalKeyResolver({ topics: { users } });
 * // あとで users.set(...) すると、購読中の欄に新しい選択肢が届く
 */
export const createMockExternalKeyResolver = <
  TType extends string = "mock",
  TContext = unknown,
>({
  type = "mock" as TType,
  topics,
}: {
  type?: TType;
  topics: Record<string, MockTopic<MockExternalKeyOption[]>>;
}): ExternalKeyResolverEntry<
  TType,
  MockExternalKeyConfig<TType, TContext>
> => ({
  type,
  resolver: (config, resolverContext) => ({
    subscribe: (callback) => {
      const topic = topics[config.topic];
      if (!topic) {
        callback([]);
        return () => {};
      }
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
      const unsubscribe = topic.subscribe(deliver);
      if (topic.has()) deliver(topic.get() ?? []);
      return unsubscribe;
    },
  }),
});
