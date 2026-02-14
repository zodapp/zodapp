import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import { queryBuilder, getAccessor } from ".";
import type { z } from "zod";
import firebase from "firebase/compat/app";

import BTree from "sorted-btree";
import { createSortTools } from "./sortTools";

type Firestore = firebase.firestore.Firestore;
type WhereFilterOp = firebase.firestore.WhereFilterOp;
type DocumentSnapshot = firebase.firestore.DocumentSnapshot;

/**
 * フェッチループ中の状態（主に `FilteredGrowingList` 向け）。
 *
 * - `scannedCount`: スキャンした総件数
 * - `filteredCount`: フィルタを通過した件数
 */
export type FetchState = {
  filteredCount: number;
  scannedCount: number;
};

/**
 * アイテム変更イベント（Discriminated Union）。
 *
 * subscribe している側が「追加/削除/更新」を差分として受け取るためのイベント型です。
 */
export type ItemChangeEvent<T> =
  | { type: "add"; docId: string; item: T }
  | { type: "remove"; docId: string }
  | { type: "update"; docId: string; item: T };

/**
 * GrowingList 系の共通状態。
 *
 * - `items`: 現在の一覧（ソート済み）
 * - `count`: `items` の件数
 * - `hasMore`: 追加取得（fetchMore）が可能か
 * - `fetchState`: フェッチ中の進捗（必要な場合のみ）
 * - `lastItemTime`: ストリームの基準となる時刻（実装依存。次回取得の境界に使う）
 */
export type GrowingListState<T> = {
  items: T[];
  count: number;
  hasMore: boolean;
  fetchState?: FetchState;
  lastItemTime: Date | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IntrinsicGrowingList<TConfig extends CollectionConfigBase = any> =
  ReturnType<typeof createIntrinsicGrowingList<TConfig>>;

// listener が 0 になってから pause するまでの遅延（ms）
const PAUSE_DELAY = 3_000;

export const createIntrinsicGrowingList = <
  TConfig extends CollectionConfigBase,
>(
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
) => {
  // 一回のget取得できるデータの上限
  const PAGE_SIZE = 50;

  type _DataType = z.infer<TConfig["dataSchema"]>;
  type Key = unknown[];

  const accessor = getAccessor(db, config);

  const normalizedQuery = query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getKeys, sortFn } = createSortTools<any>(config, query.orderBy);

  const list = new BTree<Key, _DataType>(undefined, sortFn);
  const idToDoc = new Map<string, _DataType>();

  let hasMore = true;
  let lastCursorKey: DocumentSnapshot | null = null;
  let isFetching = false;
  let hasFetchedOnce = false;
  let lastItemTime: Date | undefined = undefined;

  // pause/resume 用の状態
  let pausedAt: Date | undefined = undefined;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  let unsubscribeUpdateStream: (() => void) | undefined = undefined;

  const listeners = new Set<(state: GrowingListState<_DataType>) => void>();
  const itemChangeListeners = new Set<
    (event: ItemChangeEvent<_DataType>) => void
  >();

  const getState = (): GrowingListState<_DataType> => {
    return {
      items: Array.from(list.values()),
      count: list.size,
      hasMore,
      fetchState: isFetching
        ? { filteredCount: 0, scannedCount: 0 }
        : undefined,
      lastItemTime,
    };
  };

  const notifyListener = (
    listener: (state: GrowingListState<_DataType>) => void,
  ) => {
    listener(getState());
  };

  const notifyListeners = () => {
    const state = getState();
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  const notifyItemChange = (event: ItemChangeEvent<_DataType>) => {
    itemChangeListeners.forEach((listener) => {
      listener(event);
    });
  };

  const ensureHasMoreForNextPage = (key: Key) => {
    if (hasMore || !hasFetchedOnce) {
      return;
    }
    if (!lastCursorKey) {
      hasMore = true;
      return;
    }
    // if (sortFn(key, lastCursorKey) > 0) {
    //   hasMore = true;
    // }
  };

  // アイテムを追加/更新し、イベントを発火
  const setItem = (docId: string, data: _DataType) => {
    const existingData = idToDoc.get(docId);
    const isUpdate = existingData !== undefined;

    // 既存エントリがあれば先に削除（キーが変わった場合の二重登録を防止）
    if (existingData) {
      const oldKeys = getKeys(existingData);
      list.delete(oldKeys);
    }

    idToDoc.set(docId, data);
    const itemKeys = getKeys(data);
    list.set(itemKeys, data);
    ensureHasMoreForNextPage(itemKeys);

    // イベント発火
    if (isUpdate) {
      notifyItemChange({ type: "update", docId, item: data });
    } else {
      notifyItemChange({ type: "add", docId, item: data });
    }
  };

  const removeItem = (docId: string) => {
    // 古いデータから古いキーを計算して削除
    const oldData = idToDoc.get(docId);
    if (oldData) {
      const oldKeys = getKeys(oldData);
      list.delete(oldKeys);
      idToDoc.delete(docId);
      // イベント発火
      notifyItemChange({ type: "remove", docId });
    }
  };

  // upstream ストリームを開始する
  const startUpdateStream = (sinceTime: Date) => {
    if (unsubscribeUpdateStream) {
      // 既に開始済みの場合は何もしない
      return;
    }
    unsubscribeUpdateStream = accessor.querySnapshotSync(
      collectionIdentityParams,
      {
        where: [
          ...(streamQuery?.where ?? query?.where ?? []),
          {
            field: streamField,
            operator: ">",
            // 取りこぼし防止のため、少しだけ過去にずらす（時刻ずれ/遅延のマージン）
            value: firebase.firestore.Timestamp.fromMillis(
              sinceTime.getTime() - 5_000,
            ),
          },
        ],
      },
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = accessor.docToDataSafe(
            change.doc,
            collectionIdentityParams,
          );
          const docId = change.doc.id;
          if (change.type === "removed") {
            removeItem(docId);
          } else {
            // added / modified どちらも setItem で処理（既存エントリは内部で削除される）
            setItem(docId, data);
          }
        });
        notifyListeners();
      },
    );
  };

  // upstream ストリームを停止し、pause 時刻を記録
  const pauseUpdateStream = () => {
    if (unsubscribeUpdateStream) {
      unsubscribeUpdateStream();
      unsubscribeUpdateStream = undefined;
      pausedAt = new Date();
    }
  };

  // upstream ストリームを再開（pause 時刻を基準に）
  const resumeUpdateStream = () => {
    if (pausedAt) {
      startUpdateStream(pausedAt);
      pausedAt = undefined;
    }
  };

  // pause タイマーを停止
  const stopPauseTimer = () => {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = undefined;
    }
  };

  // pause タイマーを開始
  const startPauseTimer = () => {
    stopPauseTimer();
    pauseTimer = setTimeout(() => {
      pauseTimer = undefined;
      pauseUpdateStream();
    }, PAUSE_DELAY);
  };

  // 初回ストリーム開始
  startUpdateStream(new Date());

  // fetchMoreは1回のみ実行（再帰なし）
  const fetchMore = async () => {
    if (!hasMore || isFetching) {
      return;
    }
    isFetching = true;
    notifyListeners();
    try {
      const pageQueryOptions: NonNullable<Parameters<typeof queryBuilder>[0]> =
        {
          ...normalizedQuery,
          limit: PAGE_SIZE,
        };
      if (lastCursorKey) {
        pageQueryOptions.startAfter = lastCursorKey;
      }
      const docs = await accessor.querySnapshot(collectionIdentityParams, (q) =>
        queryBuilder(pageQueryOptions)(q),
      );

      hasFetchedOnce = true;
      if (docs.length > 0) {
        lastCursorKey = docs[docs.length - 1]!;
      }
      hasMore = docs.length === PAGE_SIZE;
      docs.forEach((doc) => {
        const data = accessor.docToDataSafe(doc, collectionIdentityParams);
        const docId = doc.id;
        setItem(docId, data);
      });
      const lastData =
        lastCursorKey &&
        accessor.docToDataSafe(lastCursorKey, collectionIdentityParams);

      const fieldForOrder = query.orderBy?.[0]?.field;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastItemTime =
        (fieldForOrder && (lastData as any)?.[fieldForOrder]) ?? undefined;
      isFetching = false;
      notifyListeners();
    } catch (error) {
      console.error("fetchMore error", error);
      isFetching = false;
      notifyListeners();
    }
  };

  const startFetch = () => {
    if (isFetching || !hasMore) {
      return;
    }
    fetchMore();
  };

  startFetch();

  return {
    subscribe: (listener: (state: GrowingListState<_DataType>) => void) => {
      const wasEmpty = listeners.size === 0;
      listeners.add(listener);

      // 0→1: pause タイマーをキャンセルして resume
      if (wasEmpty) {
        stopPauseTimer();
        resumeUpdateStream();
      }

      notifyListener(listener);
      return () => {
        listeners.delete(listener);
        // 1→0: pause タイマーを開始
        if (listeners.size === 0) {
          startPauseTimer();
        }
      };
    },
    onItemChange: (listener: (event: ItemChangeEvent<_DataType>) => void) => {
      itemChangeListeners.add(listener);
      return () => {
        itemChangeListeners.delete(listener);
      };
    },
    getState,
    fetchMore: () => {
      startFetch();
    },
    dispose: () => {
      stopPauseTimer();
      if (unsubscribeUpdateStream) {
        unsubscribeUpdateStream();
        unsubscribeUpdateStream = undefined;
      }
      listeners.clear();
      itemChangeListeners.clear();
    },
  };
};
