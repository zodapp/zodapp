import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { stableStringify } from "@zodapp/caching-utilities";
import type { CollectionConfigBase, QueryOptions } from "@zodapp/zod-firebase";
import type { z } from "zod";
import type firebase from "firebase/compat/app";
import type { AccessorStoreKey } from "../firestore";
import {
  createFilteredGrowingList,
  type FilteredGrowingList,
} from "../firestore/filteredGrowingList";

type Firestore = firebase.firestore.Firestore;

/**
 * `useGrowingList` が返す一覧状態の基本形。
 *
 * `FilteredGrowingList` の取得進捗（filtered/scanned）を含みます。
 */
export type GrowingListState<T> = {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  filteredCount: number;
  scannedCount: number;
  error?: Error;
};

/**
 * `useGrowingList` のオプション。
 *
 * - `collection`: 対象コレクション定義
 * - `collectionIdentity`: 対象コレクションの識別パラメータ。
 *   `undefined` を渡すと監視を行わず空の結果を返す。
 * - `streamField`: 変更購読（stream）の基準にするフィールド名
 * - `clientFilter`: クライアント側フィルタ（任意）
 */
export type UseGrowingListOptions<TConfig extends CollectionConfigBase> = {
  storeKey: AccessorStoreKey;
  collection: TConfig;
  collectionIdentity?: z.infer<TConfig["collectionIdentitySchema"]>;
  query?: QueryOptions;
  streamField: string;
  streamQuery?: QueryOptions;
  clientFilter?: (item: z.infer<TConfig["dataSchema"]>) => boolean;
};

/**
 * `useGrowingList` の戻り値。
 *
 * `fetchMore()` でページング取得を進めます。
 */
export type UseGrowingListResult<T> = GrowingListState<T> & {
  fetchMore: () => void;
};

const emptyState: GrowingListState<never> = {
  items: [],
  hasMore: false,
  isLoading: false,
  filteredCount: 0,
  scannedCount: 0,
  error: undefined,
};

/**
 * firestore インスタンスをバインドした useGrowingList フックを作成するファクトリ関数
 */
export function createUseGrowingList(firestore: Firestore) {
  return function useGrowingList<TConfig extends CollectionConfigBase>(
    options: UseGrowingListOptions<TConfig>,
  ): UseGrowingListResult<z.infer<TConfig["dataSchema"]>> {
    type ItemType = z.infer<TConfig["dataSchema"]>;

    const {
      collection,
      storeKey,
      collectionIdentity,
      query,
      streamField,
      streamQuery,
      clientFilter,
    } = options;

    const [state, setState] = useState<GrowingListState<ItemType>>({
      items: [],
      hasMore: true,
      isLoading: true,
      filteredCount: 0,
      scannedCount: 0,
      error: undefined,
    });

    const growingListRef = useRef<FilteredGrowingList<TConfig> | null>(null);

    // collectionIdentityの依存値をメモ化
    const collectionIdentityKey = useMemo(
      () => stableStringify(collectionIdentity),
      [collectionIdentity],
    );

    // queryの依存値をメモ化
    const queryKey = useMemo(() => stableStringify(query), [query]);
    const streamQueryKey = useMemo(
      () => stableStringify(streamQuery),
      [streamQuery],
    );
    const stableCollectionIdentity = useMemo(
      () => collectionIdentity,
      [collectionIdentityKey],
    );

    const normalizedQuery = useMemo(
      () => ({
        where: query?.where ?? [],
        orderBy: query?.orderBy ?? [
          { field: "createdAt", direction: "desc" as const },
        ],
      }),
      [queryKey],
    );
    const normalizedStreamQuery = useMemo(
      () => streamQuery,
      [streamQueryKey],
    );

    useEffect(() => {
      if (stableCollectionIdentity === undefined) {
        setState(emptyState as GrowingListState<ItemType>);
        growingListRef.current = null;
        return;
      }

      setState({
        items: [],
        hasMore: true,
        isLoading: true,
        filteredCount: 0,
        scannedCount: 0,
        error: undefined,
      });

      const growingList = createFilteredGrowingList(
        firestore,
        collection,
        storeKey,
        stableCollectionIdentity,
        normalizedQuery,
        streamField,
        normalizedStreamQuery,
        clientFilter,
      );

      growingListRef.current = growingList;

      const unsub = growingList.subscribe((listState) => {
        setState({
          items: listState.items,
          hasMore: listState.hasMore,
          isLoading: listState.fetchState !== undefined,
          filteredCount: listState.filteredCount,
          scannedCount: listState.scannedCount,
          error: listState.error,
        });
      });

      return () => {
        if (growingListRef.current === growingList) {
          growingListRef.current = null;
        }
        unsub();
        growingList.dispose();
      };
    }, [
      collection,
      firestore,
      normalizedQuery,
      normalizedStreamQuery,
      stableCollectionIdentity,
      storeKey,
      streamField,
    ]);

    // clientFilterが変更されたときに自動でsetFilterを呼ぶ
    useEffect(() => {
      growingListRef.current?.setFilter(clientFilter);
    }, [clientFilter]);

    const fetchMore = useCallback(() => {
      growingListRef.current?.fetchMore();
    }, []);

    return { ...state, fetchMore };
  };
}
