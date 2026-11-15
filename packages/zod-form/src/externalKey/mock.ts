import type { BaseExternalKeyConfig, ExternalKeyResolverEntry } from "./types";

/** モックの選択肢 */
export type MockExternalKeyOption = { label: string; value: string };

/**
 * モックの externalKey の config。
 *
 * - `source`: 選択肢の出どころの名前（`createMockExternalKeyResolver` の `sources` のキー）
 * - `params`: 出どころに渡す値（親の値で選択肢を変えるときなど）
 * - `delayMs`: 選択肢を返すまでの待ち時間。読み込み中の表示を見るため
 * - `updateIntervalMs`: 指定すると、この間隔で選択肢を届け直す（購読の更新を見るため）。
 *   出どころの関数は 2 つ目の引数に、何回目に届けるか（0 始まり）を受け取る
 */
export type MockExternalKeyConfig<TType extends string = "mock"> =
  BaseExternalKeyConfig<TType> & {
    source: string;
    params?: Record<string, string | number | boolean | null | undefined>;
    delayMs?: number;
    updateIntervalMs?: number;
  };

/**
 * ローカル開発用のモック externalKey resolver。
 * `sources` に書いた関数から選択肢を作り、`delayMs` だけ待ってから返す。
 *
 * @example
 * createMockExternalKeyResolver({
 *   sources: {
 *     users: () => [{ label: "山田", value: "u1" }],
 *     cities: (params) => CITIES[String(params.prefecture)] ?? [],
 *   },
 * })
 */
export const createMockExternalKeyResolver = <TType extends string = "mock">({
  type = "mock" as TType,
  sources,
  delayMs: defaultDelayMs = 300,
}: {
  type?: TType;
  sources: Record<
    string,
    (
      params: NonNullable<MockExternalKeyConfig["params"]>,
      tick: number,
    ) => MockExternalKeyOption[]
  >;
  delayMs?: number;
}): ExternalKeyResolverEntry<TType, MockExternalKeyConfig<TType>> => ({
  type,
  resolver: (config) => ({
    subscribe: (callback) => {
      const source = sources[config.source];
      let tick = 0;
      const send = () => {
        callback(source ? source(config.params ?? {}, tick) : []);
        tick += 1;
      };
      let interval: ReturnType<typeof setInterval> | undefined;
      const timer = setTimeout(() => {
        send();
        if (config.updateIntervalMs) {
          interval = setInterval(send, config.updateIntervalMs);
        }
      }, config.delayMs ?? defaultDelayMs);
      return () => {
        clearTimeout(timer);
        if (interval) clearInterval(interval);
      };
    },
  }),
});
