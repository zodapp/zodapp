import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { stableStringify } from "@zodapp/caching-utilities";
import type {
  CollectionConfigBase,
  QueryOptions,
} from "@zodapp/zod-firebase";
import type { z } from "zod";
import type firebase from "firebase/compat/app";
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
};

/**
 * `useGrowingList` のオプション。
 *
 * - `streamField`: 変更購読（stream）の基準にするフィールド名
 * - `clientFilter`: クライアント側フィルタ（任意）
 */
export type UseGrowingListOptions<TConfig extends CollectionConfigBase> = {
  collection: TConfig;
  pathParams: z.infer<TConfig["collectionIdentitySchema"]>;
  query?: QueryOptions;
  streamField: string;
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

/**
 * firestore インスタンスをバインドした useGrowingList フックを作成するファクトリ関数
 */
export function createUseGrowingList(firestore: Firestore) {
  return function useGrowingList<TConfig extends CollectionConfigBase>(
    options: UseGrowingListOptions<TConfig>,
  ): UseGrowingListResult<z.infer<TConfig["dataSchema"]>> {
    type ItemType = z.infer<TConfig["dataSchema"]>;

    const { collection, pathParams, query, streamField, clientFilter } =
      options;

    const [state, setState] = useState<GrowingListState<ItemType>>({
      items: [],
      hasMore: true,
      isLoading: true,
      filteredCount: 0,
      scannedCount: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const growingListRef = useRef<FilteredGrowingList<any> | null>(null);

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
      if (hasEmptyParams) return;

      const normalizedQuery = {
        where: query?.where ?? [],
        orderBy: query?.orderBy ?? [
          { field: "createdAt", direction: "desc" as const },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gl = createFilteredGrowingList(
        firestore,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        collection as any,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        pathParams as any,
        normalizedQuery,
        streamField,
        undefined,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        clientFilter as any,
      );

      growingListRef.current = gl;

      const unsub = gl.subscribe((listState) => {
        setState({
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          items: listState.items as ItemType[],
          hasMore: listState.hasMore,
          isLoading: listState.fetchState !== undefined,
          filteredCount: listState.filteredCount,
          scannedCount: listState.scannedCount,
        });
      });

      return () => {
        unsub();
        gl.dispose();
      };
    }, [
      pathParamsKey,
      queryKey,
      collection,
      streamField,
      clientFilter,
      pathParams,
      query,
    ]);

    // clientFilterが変更されたときに自動でsetFilterを呼ぶ
    useEffect(() => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      growingListRef.current?.setFilter(clientFilter as any);
    }, [clientFilter]);

    const fetchMore = useCallback(() => {
      growingListRef.current?.fetchMore();
    }, []);

    return { ...state, fetchMore };
  };
}
