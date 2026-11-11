/**
 * React の hooks（K4）。一覧と Item の状態は Client のフレームワーク非依存の store が持ち、
 * hooks は `useSyncExternalStore` でそれを読むだけ。`createUseList(api.tasks.byStatus, { live })`
 * のように、操作を部分適用した hook を作って使う。
 */
import {
  onceItemStore,
  onceListStore,
  type GetFunction,
  type ItemState,
  type ItemStore,
  type ListState,
  type ListStore,
  type LiveListOptions,
  type LiveQueryFunction,
  type OnceListOptions,
  type QueryFunction,
} from "@zodapp/zod-dynamodb-client";
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** 値から、変わったかどうかを判定するためのキーを作る（オブジェクトのキーの順によらない） */
export const stableKey = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => {
    if (typeof v === "bigint") return `${v}n`;
    if (v instanceof Set)
      return { $set: [...v].map((x) => stableKey(x)).sort() };
    if (v instanceof Map) return { $map: [...v.entries()] };
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      );
    }
    return v;
  }) ?? "undefined";

type AnyStore<S> = {
  getState(): S;
  subscribe(listener: () => void): () => void;
  close(): void;
};

/**
 * store を、購読者がいる間だけ持つ入れ物。購読者が 0 になったら閉じる。
 * 描画中には store を作らない（通信を始めない）。StrictMode で購読がやり直されても、正しく作り直す
 */
const createHolder = <S, TStore extends AnyStore<S>>(
  create: () => TStore,
  initial: S,
) => {
  let store: TStore | undefined;
  let count = 0;
  return {
    get store() {
      return store;
    },
    subscribe: (listener: () => void) => {
      if (!store) store = create();
      count++;
      const off = store.subscribe(listener);
      const current = store;
      // 作った直後の状態を読ませる
      listener();
      return () => {
        off();
        count--;
        if (count === 0 && store === current) {
          store = undefined;
          current.close();
        }
      };
    },
    getSnapshot: (): S => (store ? store.getState() : initial),
  };
};

const INITIAL_LIST: ListState<never> = Object.freeze({
  status: "loading",
  items: [],
  hasMore: false,
  isFetchingMore: false,
}) as ListState<never>;

const INITIAL_ITEM: ItemState<never> = Object.freeze({
  status: "loading",
  item: null,
}) as ItemState<never>;

export type UseListResult<T> = ListState<T> & {
  /** 次のページを読む（progressive） */
  fetchMore(): void;
  /** 最初から読み直す */
  reload(): void;
};

export type UseItemResult<T> = ItemState<T> & {
  reload(): void;
};

const useListStore = <TItem>(
  create: () => ListStore<TItem>,
  deps: readonly unknown[],
): UseListResult<TItem> => {
  const holder = useMemo(
    () =>
      createHolder<ListState<TItem>, ListStore<TItem>>(create, INITIAL_LIST),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  const state = useSyncExternalStore(
    holder.subscribe,
    holder.getSnapshot,
    holder.getSnapshot,
  );
  return useMemo(
    () => ({
      ...state,
      fetchMore: () => holder.store?.fetchMore(),
      reload: () => holder.store?.reload(),
    }),
    [state, holder],
  );
};

const useItemStore = <TItem>(
  create: () => ItemStore<TItem>,
  deps: readonly unknown[],
): UseItemResult<TItem> => {
  const holder = useMemo(
    () =>
      createHolder<ItemState<TItem>, ItemStore<TItem>>(create, INITIAL_ITEM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  const state = useSyncExternalStore(
    holder.subscribe,
    holder.getSnapshot,
    holder.getSnapshot,
  );
  return useMemo(
    () => ({ ...state, reload: () => holder.store?.reload() }),
    [state, holder],
  );
};

/** 一覧の hook。`params` と `options` が（値として）変わったら、作り直す */
export type UseList<TParams, TItem, TOptions> = (
  params: TParams,
  options?: TOptions,
) => UseListResult<TItem>;

/** Item の hook。`key` が（値として）変わったら、作り直す */
export type UseItem<TKey, TItem> = (key: TKey) => UseItemResult<TItem>;

/**
 * クエリの関数を部分適用した、一覧の hook を作る。モジュールの外側（コンポーネントの外）で作る。
 * `live: true` なら、リアルタイムの一覧（登録簿で `live` を付けたクエリだけ）。
 *
 * ```ts
 * export const useTodos = createUseList(api.tasks.byStatus, { live: true });
 * // コンポーネントの中
 * const { items, fetchMore } = useTodos({ workspaceId, status: "todo" }, { pageSize: 50 });
 * ```
 */
export function createUseList<TParams, TItem>(
  fn: LiveQueryFunction<TParams, TItem>,
  options: { live: true },
): UseList<TParams, TItem, LiveListOptions>;
export function createUseList<TParams, TItem, TFields>(
  fn: QueryFunction<TParams, TItem, TFields>,
  options?: { live?: false },
): UseList<TParams, TItem, OnceListOptions<TFields>>;
export function createUseList(
  fn: QueryFunction<unknown, unknown> | LiveQueryFunction<unknown, unknown>,
  options: { live?: boolean } = {},
): UseList<unknown, unknown, object> {
  if (
    options.live &&
    typeof (fn as LiveQueryFunction<unknown, unknown>).live !== "function"
  ) {
    throw new TypeError(
      "createUseList(fn, { live: true }) needs a query registered with live",
    );
  }
  return (params, listOptions) =>
    useListStore(
      () =>
        options.live
          ? (fn as LiveQueryFunction<unknown, unknown>).live(
              params,
              listOptions,
            )
          : onceListStore(
              fn as QueryFunction<unknown, unknown>,
              params,
              listOptions,
            ),
      [stableKey([params, listOptions])],
    );
}

/**
 * Get の関数を部分適用した、Item の hook を作る。状態は `ifUnchanged` に渡すトークンも持つ。
 *
 * ```ts
 * export const useTask = createUseItem(api.tasks.get);
 * const { status, item, token } = useTask({ workspaceId, taskId });
 * ```
 */
export const createUseItem =
  <TKey, TItem>(fn: GetFunction<TKey, TItem>): UseItem<TKey, TItem> =>
  (key) =>
    useItemStore(() => onceItemStore(fn, key), [stableKey(key)]);

// ---- 認証コンテキストを bind した API ----

/** `bind` を持つ API（`createClient` の戻り値） */
type BindableApi = { bind(context: unknown): unknown };

const ApiContext = createContext<unknown>(undefined);

/**
 * 認証コンテキストを bind した API を、子のコンポーネントに渡す。
 * 認証コンテキストが変われば、`useApi()` を使うコンポーネントは描画し直す。
 *
 * ```tsx
 * <ApiProvider api={api} context={auth}>
 *   <App />
 * </ApiProvider>
 * ```
 */
export const ApiProvider = <A extends BindableApi>(props: {
  api: A;
  context: unknown;
  children?: ReactNode;
}) => {
  const bound = useMemo(
    () => props.api.bind(props.context),
    [props.api, props.context],
  );
  return createElement(ApiContext.Provider, { value: bound }, props.children);
};

/**
 * `ApiProvider` が bind した API を返す。描画中（`can` の判定など）はこちらを使う。
 * イベントハンドラーや effect の中では、bind していない API を使ってもよい。
 */
export const useApi = <A extends BindableApi>(api?: A): A => {
  const bound = useContext(ApiContext);
  if (bound === undefined) {
    throw new Error("useApi() must be used inside <ApiProvider>");
  }
  void api; // 型を決めるためだけの引数
  return bound as A;
};
