import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import type { z } from "zod";
import firebase from "firebase/compat/app";

import BTree from "sorted-btree";

import {
  type FetchState,
  type GrowingListState,
  type ItemChangeEvent,
} from "./intrinsitGrowingList";
import { createCachedGrowingList } from "./cachedGrowingList";
import { createSortTools } from "./sortTools";

type Firestore = firebase.firestore.Firestore;
type WhereFilterOp = firebase.firestore.WhereFilterOp;

/**
 * `FilteredGrowingList` 用の状態型。
 *
 * `GrowingListState` に「スキャン件数 / フィルタ通過件数」を追加します。
 */
export type FilteredGrowingListState<T> = GrowingListState<T> & {
  scannedCount: number;
  filteredCount: number;
};

/**
 * `createFilteredGrowingList()` の戻り値型。
 *
 * `fetchMore()` で段階的に取得しつつ、client-side filter を適用した一覧を購読できます。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilteredGrowingList<TConfig extends CollectionConfigBase = any> =
  ReturnType<typeof createFilteredGrowingList<TConfig>>;

/**
 * client-side filter 付きの GrowingList を作成します。
 *
 * 元となる GrowingList を購読しつつ、指定されたフィルタを適用した一覧を提供します。
 * `fetchMore()` は「スキャン上限 / フィルタ上限」を考慮しながら段階的に取得を進めます。
 */
export const createFilteredGrowingList = <TConfig extends CollectionConfigBase>(
  db: Firestore,
  config: TConfig,
  collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
  query: {
    where?: {
      field: string;
      operator: WhereFilterOp;
      value: unknown;
    }[];
    orderBy: {
      field: string;
      direction: "asc" | "desc";
    }[];
  },
  streamField: string,
  streamQuery?: {
    where?: {
      field: string;
      operator: WhereFilterOp;
      value: unknown;
    }[];
  },
  initialFilterFn?: (item: z.infer<TConfig["dataSchema"]>) => boolean,
) => {
  // 一回のユーザリクエスト(fetchMore)で取得できるデータの上限
  const SCANNED_LIMIT = 100;
  // 一回のユーザリクエスト(fetchMore)でこれを超えたら取得を停止するデータ数
  const FILTERED_LIMIT = 10;

  type _DataType = z.infer<TConfig["dataSchema"]>;
  type Key = unknown[];

  // ソースのGrowingListを作成（キャッシュ経由）
  const source = createCachedGrowingList(
    db,
    config,
    collectionIdentityParams,
    query,
    streamField,
    streamQuery,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getKeys, sortFn } = createSortTools<any>(config, query.orderBy);

  let filterFn = initialFilterFn;

  const filteredList = new BTree<Key, _DataType>(undefined, sortFn);
  const idToFilteredItem = new Map<string, _DataType>();

  let sourceState: GrowingListState<_DataType> = {
    items: [],
    count: 0,
    hasMore: true,
    lastItemTime: undefined,
  };
  let fetchState: FetchState | undefined = undefined;

  const listeners = new Set<
    (state: FilteredGrowingListState<_DataType>) => void
  >();

  const getState = (): FilteredGrowingListState<_DataType> => {
    return {
      items: Array.from(filteredList.values()),
      count: filteredList.size,
      hasMore: sourceState.hasMore,
      fetchState: fetchState ?? sourceState.fetchState,
      lastItemTime: sourceState.lastItemTime,
      scannedCount: sourceState.count,
      filteredCount: filteredList.size,
    };
  };

  const notifyListener = (
    listener: (state: FilteredGrowingListState<_DataType>) => void,
  ) => {
    listener(getState());
  };

  const notifyListeners = () => {
    const state = getState();
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  // フィルタを適用してfilteredListを更新
  const applyFilterToItem = (docId: string, item: _DataType): boolean => {
    const itemKeys = getKeys(item);
    const passes = !filterFn || filterFn(item);

    if (passes) {
      // 既存のエントリがあれば削除（キーが変わった場合の二重登録を防止）
      const existingItem = idToFilteredItem.get(docId);
      if (existingItem) {
        const oldKeys = getKeys(existingItem);
        filteredList.delete(oldKeys);
      }
      filteredList.set(itemKeys, item);
      idToFilteredItem.set(docId, item);
      return true;
    } else {
      // フィルタを通過しなかった場合、既存のエントリがあれば削除
      const existingItem = idToFilteredItem.get(docId);
      if (existingItem) {
        const oldKeys = getKeys(existingItem);
        filteredList.delete(oldKeys);
        idToFilteredItem.delete(docId);
      }
      return false;
    }
  };

  const removeFilteredItem = (docId: string) => {
    const existingItem = idToFilteredItem.get(docId);
    if (existingItem) {
      const oldKeys = getKeys(existingItem);
      filteredList.delete(oldKeys);
      idToFilteredItem.delete(docId);
    }
  };

  // ソースの状態変更を購読
  const unsubscribeSource = source.subscribe((state) => {
    sourceState = state;
    // fetchStateの更新とfetchMore再帰のトリガーはここでは行わない
    // （onItemChangeで処理）
    notifyListeners();
  });

  // ソースのアイテム変更を購読（効率的なフィルタリング）
  const unsubscribeItemChange = source.onItemChange(
    (event: ItemChangeEvent<_DataType>) => {
      switch (event.type) {
        case "add":
        case "update": {
          const added = applyFilterToItem(event.docId, event.item);
          // fetchState中なら再帰判定のためにカウントを更新
          if (fetchState) {
            fetchState.scannedCount++;
            if (added) {
              fetchState.filteredCount++;
            }
          }
          break;
        }
        case "remove":
          removeFilteredItem(event.docId);
          break;
      }
      notifyListeners();
    },
  );

  // fetchMoreの再帰呼び出し
  const fetchMoreRecursive = async () => {
    if (!sourceState.hasMore || !fetchState) {
      fetchState = undefined;
      notifyListeners();
      return;
    }

    // ソースのfetchMoreを呼び出し
    source.fetchMore();

    // ソースのfetchが完了するのを待つ（subscribeで状態が更新される）
    await new Promise<void>((resolve) => {
      const checkComplete = () => {
        // ソースのfetchStateがundefinedになったら完了
        if (!sourceState.fetchState) {
          resolve();
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });

    // 再帰判定
    if (
      fetchState &&
      sourceState.hasMore &&
      fetchState.scannedCount < SCANNED_LIMIT &&
      fetchState.filteredCount < FILTERED_LIMIT
    ) {
      await fetchMoreRecursive();
    } else {
      fetchState = undefined;
      notifyListeners();
    }
  };

  const startFetch = () => {
    if (fetchState || !sourceState.hasMore) {
      return;
    }
    fetchState = {
      filteredCount: 0,
      scannedCount: 0,
    };
    fetchMoreRecursive();
  };

  const setFilter = (_filterFn?: (item: _DataType) => boolean) => {
    filterFn = _filterFn;
    filteredList.clear();
    idToFilteredItem.clear();

    // ソースの全データにフィルタを再適用
    source.getState().items.forEach((item) => {
      const docId = item[config.documentKey] as string;
      applyFilterToItem(docId, item);
    });
    notifyListeners();
  };

  // 初期データにフィルタを適用
  // （ソースが既にデータを持っている場合に対応）
  source.getState().items.forEach((item) => {
    const docId = item[config.documentKey] as string;
    applyFilterToItem(docId, item);
  });

  return {
    subscribe: (
      listener: (state: FilteredGrowingListState<_DataType>) => void,
    ) => {
      listeners.add(listener);
      notifyListener(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    fetchMore: () => {
      startFetch();
    },
    setFilter,
    dispose: () => {
      unsubscribeSource();
      unsubscribeItemChange();
      source.release();
      listeners.clear();
    },
  };
};
