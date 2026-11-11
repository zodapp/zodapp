/**
 * 一覧の画面で使う補助。zodapp の ListQuerySpec / useExportFetchAll（Firestore のクエリ）の代わり。
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ListState, ListStore } from "@zodapp/zod-dynamodb-client";

export type ClientFilter = ((item: Record<string, unknown>) => boolean) | undefined;

/** 読み込んだ一覧を、画面の検索条件（mingo）で絞り込む */
export const useFiltered = <T,>(items: readonly T[], filter: ClientFilter): T[] =>
  useMemo(
    () =>
      filter
        ? items.filter((item) => filter(item as Record<string, unknown>))
        : [...items],
    [items, filter],
  );

/**
 * 名前付きクエリを最後のページまで読む（CSV のエクスポート用）。
 * `api.tasks.active.pages(params)` のような、ページの非同期イテレーターを受け取る。
 */
export const fetchAllPages = async <T,>(
  pages: AsyncIterable<{ items: readonly T[] }>,
  filter?: ClientFilter,
): Promise<T[]> => {
  const all: T[] = [];
  for await (const page of pages) all.push(...page.items);
  return filter ? all.filter((item) => filter(item as Record<string, unknown>)) : all;
};

const LOADING: ListState<never> = {
  status: "loading",
  items: [],
  hasMore: false,
  isFetchingMore: false,
};

/**
 * どのクエリを読むかを、画面の状態で切り替える一覧の hook。
 * `createUseList` の hook は呼ぶ数を変えられないため、使わない一覧まで購読してしまう。
 * ここでは store を作る関数を受け取り、`deps` が変わったら作り直す。
 */
export const useListStore = <T,>(
  create: () => ListStore<T>,
  deps: readonly unknown[],
): ListState<T> & { fetchMore(): void; reload(): void } => {
  const [store, setStore] = useState<ListStore<T> | null>(null);
  useEffect(() => {
    const next = create();
    setStore(next);
    return () => next.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribe(listener) : () => {}),
    [store],
  );
  const state = useSyncExternalStore(subscribe, () =>
    store ? store.getState() : (LOADING as ListState<T>),
  );
  return useMemo(
    () => ({
      ...state,
      fetchMore: () => store?.fetchMore(),
      reload: () => store?.reload(),
    }),
    [state, store],
  );
};
