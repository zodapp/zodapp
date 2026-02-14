import { useState, useEffect, useCallback, useMemo } from "react";
import { stableStringify } from "@zodapp/caching-utilities";
import type { CollectionConfigBase, QueryOptions } from "@zodapp/zod-firebase";
import type { z } from "zod";
import type firebase from "firebase/compat/app";
import { getAccessor } from "../firestore";

type Firestore = firebase.firestore.Firestore;

/**
 * `useList` が返す一覧状態の基本形。
 *
 * - `items`: 取得済みアイテム（必要ならフィルタ適用後）
 * - `hasMore`: 追加取得できるか（`useList` では常に `false`）
 * - `isLoading`: 初期ロード中か
 */
export type ListState<T> = {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
};

/**
 * `useList` のオプション。
 *
 * - `collection` / `pathParams`: 対象コレクション
 * - `query`: Firestore クエリ条件（任意）
 * - `clientFilter`: クライアント側フィルタ（任意。`setFilter` より優先度は低い）
 */
export type UseListOptions<TConfig extends CollectionConfigBase> = {
  collection: TConfig;
  pathParams: z.infer<TConfig["collectionIdentitySchema"]>;
  query?: QueryOptions;
  clientFilter?: (item: z.infer<TConfig["dataSchema"]>) => boolean;
};

/**
 * `useList` の戻り値。
 *
 * `fetchMore()` は互換性のために提供されますが、`useList` 自体は全件同期を行うため no-op です。
 */
export type UseListResult<T> = ListState<T> & {
  fetchMore: () => void;
  setFilter: (filterFn?: (item: T) => boolean) => void;
};

/**
 * firestore インスタンスをバインドした useList フックを作成するファクトリ関数
 */
export function createUseList(firestore: Firestore) {
  return function useList<TConfig extends CollectionConfigBase>(
    options: UseListOptions<TConfig>,
  ): UseListResult<z.infer<TConfig["dataSchema"]>> {
    type ItemType = z.infer<TConfig["dataSchema"]>;

    const { collection, pathParams, query, clientFilter } = options;

    const [items, setItems] = useState<ItemType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // setFilter で明示的に設定されたフィルタ（clientFilter より優先）
    const [filter, setFilterState] = useState<
      ((item: ItemType) => boolean) | undefined
    >(undefined);

    // pathParamsの依存値をメモ化
    const pathParamsKey = useMemo(
      () => stableStringify(pathParams),
      [pathParams],
    );

    // queryの依存値をメモ化
    const queryKey = useMemo(() => stableStringify(query), [query]);

    useEffect(() => {
      // pathParamsに空文字が含まれる場合は初期化しない
      const hasEmptyParams = Object.values(pathParams).some(
        (value) => value === "" || value === undefined,
      );
      if (hasEmptyParams) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const accessor = getAccessor(firestore, collection as any);

      const normalizedQuery = {
        where: query?.where ?? [],
        orderBy: query?.orderBy ?? [
          { field: "createdAt", direction: "desc" as const },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const unsub = accessor.querySync(
        pathParams as z.infer<TConfig["collectionIdentitySchema"]>,
        normalizedQuery,
        (docs) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          setItems(docs as ItemType[]);
          setIsLoading(false);
        },
      );

      return () => {
        unsub();
      };
    }, [pathParamsKey, queryKey, collection]);

    // フィルタを適用したアイテムを計算
    const filteredItems = useMemo(() => {
      const activeFilter = filter ?? clientFilter;
      if (!activeFilter) return items;
      return items.filter(activeFilter);
    }, [items, filter, clientFilter]);

    // fetchMoreは互換性のために提供するが、何もしない（全データ取得済み）
    const fetchMore = useCallback(() => {
      // no-op: useListは全データを取得するため追加読み込みは不要
    }, []);

    const setFilter = useCallback((filterFn?: (item: ItemType) => boolean) => {
      setFilterState(() => filterFn);
    }, []);

    return {
      items: filteredItems,
      hasMore: false, // 常にfalse（全データ取得済み）
      isLoading,
      fetchMore,
      setFilter,
    };
  };
}
