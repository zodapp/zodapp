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
  /** 値を変え、購読者全員に届ける。関数を渡すと今の値から作る。失敗の状態は消える */
  set: (next: T | ((prev: T | undefined) => T)) => void;
  /**
   * 購読者全員に失敗を届け、失敗の状態を覚える。値はそのまま残る。
   * 失敗の状態は、次の `set` まで続く
   */
  fail: (error: unknown) => void;
  /** 失敗の状態か。失敗の状態なら、その error を持つ */
  failure: () => { error: unknown } | undefined;
  /**
   * 値が変わるたびに listener を、失敗したら onError を呼ぶ。
   * 今の値や今の失敗は届けない。戻り値で購読をやめる
   */
  subscribe: (
    listener: (value: T) => void,
    onError?: (error: unknown) => void,
  ) => () => void;
};

type TopicSubscriber<T> = {
  listener: (value: T) => void;
  onError?: (error: unknown) => void;
};

export function createMockTopic<T>(): MockTopic<T>;
export function createMockTopic<T>(initial: T): MockTopic<T>;
export function createMockTopic<T>(...args: [] | [T]): MockTopic<T> {
  let hasValue = args.length > 0;
  let value = args[0];
  let failure: { error: unknown } | undefined;
  const subscribers = new Set<TopicSubscriber<T>>();
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
      failure = undefined;
      for (const subscriber of [...subscribers]) subscriber.listener(nextValue);
    },
    fail: (error) => {
      failure = { error };
      for (const subscriber of [...subscribers]) subscriber.onError?.(error);
    },
    failure: () => failure,
    subscribe: (listener, onError) => {
      const subscriber = { listener, onError };
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
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
 * - topic の `fail` で onError を呼ぶ。失敗の状態の topic を購読すると、その場で onError を呼ぶ
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
    subscribe: (callback, onError) => {
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
      const unsubscribe = topic.subscribe(deliver, onError);
      const failure = topic.failure();
      if (failure) onError?.(failure.error);
      else if (topic.has()) deliver(topic.get() ?? []);
      return unsubscribe;
    },
  }),
});
