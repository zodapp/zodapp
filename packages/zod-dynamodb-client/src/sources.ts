/**
 * API の関数から一覧と Item の store を作る（React の `createUseList` と `createUseItem` が使う）。
 */
import type { LiveListOptions } from "./live";
import {
  createOnceItemStore,
  createOnceListStore,
  type ItemStore,
  type ListOptions,
  type ListStore,
} from "./store";

/** クエリの関数（`api.tasks.byStatus`）のうち、一覧の store を作るのに使う部分 */
export type QueryFunction<TParams, TItem, TFields = unknown> = {
  (
    params: TParams,
    options?: { cursor?: string; limit?: number; fields?: TFields },
  ): Promise<{ items: TItem[]; cursor?: string }>;
};

/** `live` を付けたクエリの関数 */
export type LiveQueryFunction<TParams, TItem> = {
  live(params: TParams, options?: LiveListOptions): ListStore<TItem>;
};

/** Get の関数（`api.tasks.get`） */
export type GetFunction<TKey, TItem> = (
  key: TKey,
  options: { withToken: true },
) => Promise<{ item: TItem | null; token?: string }>;

export type OnceListOptions<TFields = unknown> = ListOptions & {
  /** 返すフィールドの指定 */
  fields?: TFields;
};

/** 1 回きりの一覧の store。ページを `cursor` で順に読む */
export const onceListStore = <TParams, TItem, TFields>(
  fn: QueryFunction<TParams, TItem, TFields>,
  params: TParams,
  options: OnceListOptions<TFields> = {},
): ListStore<TItem> =>
  createOnceListStore(async (cursor, limit) => {
    const out = await fn(params, { cursor, limit, fields: options.fields });
    return { items: out.items, cursor: out.cursor };
  }, options);

/** 1 回きりの Item の store（`ifUnchanged` に渡すトークンも持つ） */
export const onceItemStore = <TKey, TItem>(
  fn: GetFunction<TKey, TItem>,
  key: TKey,
): ItemStore<TItem> => createOnceItemStore(() => fn(key, { withToken: true }));
