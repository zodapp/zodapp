import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stableStringify } from "@zodapp/caching-utilities";
import type { CollectionConfigBase, QueryOptions } from "@zodapp/zod-firebase";
import type { z } from "zod";
import type firebase from "firebase/compat/app";
import { getAccessor, type AccessorStoreKey } from "../firestore";

type Firestore = firebase.firestore.Firestore;
type QueryDocumentSnapshot = firebase.firestore.QueryDocumentSnapshot;

export type CollectionGroupListState<T> = {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  filteredCount: number;
  scannedCount: number;
  error?: Error;
};

export type UseCollectionGroupListOptions<
  TConfig extends CollectionConfigBase,
> = {
  storeKey: AccessorStoreKey;
  collection: TConfig;
  query?: QueryOptions;
  clientFilter?: (item: z.infer<TConfig["dataSchema"]>) => boolean;
  pageSize?: number;
  enabled?: boolean;
};

export type UseCollectionGroupListResult<T> = CollectionGroupListState<T> & {
  fetchMore: () => void;
  refresh: () => void;
};

const emptyState: CollectionGroupListState<never> = {
  items: [],
  hasMore: false,
  isLoading: false,
  filteredCount: 0,
  scannedCount: 0,
  error: undefined,
};

export function createUseCollectionGroupList(firestore: Firestore) {
  return function useCollectionGroupList<TConfig extends CollectionConfigBase>(
    options: UseCollectionGroupListOptions<TConfig>,
  ): UseCollectionGroupListResult<z.infer<TConfig["dataSchema"]>> {
    type ItemType = z.infer<TConfig["dataSchema"]>;

    const {
      storeKey,
      collection,
      query,
      clientFilter,
      pageSize = 100,
      enabled = true,
    } = options;
    const accessor = useMemo(
      () => getAccessor(firestore, collection, storeKey),
      [collection, storeKey],
    );

    const [state, setState] = useState<CollectionGroupListState<ItemType>>({
      items: [],
      hasMore: enabled,
      isLoading: enabled,
      filteredCount: 0,
      scannedCount: 0,
      error: undefined,
    });
    const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
    const generationRef = useRef(0);
    const queryRef = useRef(query);
    const clientFilterRef = useRef(clientFilter);

    const queryKey = useMemo(() => stableStringify(query), [query]);
    const stableQuery = useMemo(() => query, [queryKey]);

    useEffect(() => {
      queryRef.current = stableQuery;
    }, [stableQuery]);

    useEffect(() => {
      clientFilterRef.current = clientFilter;
    }, [clientFilter]);

    const loadPage = useCallback(
      async (reset: boolean) => {
        const generation = reset
          ? generationRef.current + 1
          : generationRef.current;
        if (reset) {
          generationRef.current = generation;
        }

        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: undefined,
        }));

        try {
          const docs = await accessor.collectionGroupQuerySnapshot({
            where: queryRef.current?.where,
            orderBy: queryRef.current?.orderBy,
            limit: pageSize,
            startAfter: reset ? undefined : (lastDocRef.current ?? undefined),
          });

          if (generationRef.current !== generation) {
            return;
          }

          lastDocRef.current =
            (docs[docs.length - 1] as QueryDocumentSnapshot | undefined) ??
            null;
          const nextItems = docs.map((doc) =>
            accessor.collectionGroupDocToDataSafe(doc),
          );
          const filteredItems = clientFilterRef.current
            ? nextItems.filter(clientFilterRef.current)
            : nextItems;

          setState((prev) => ({
            items: reset ? filteredItems : [...prev.items, ...filteredItems],
            isLoading: false,
            hasMore: docs.length === pageSize,
            filteredCount: reset
              ? filteredItems.length
              : prev.filteredCount + filteredItems.length,
            scannedCount: reset ? docs.length : prev.scannedCount + docs.length,
            error: undefined,
          }));
        } catch (error) {
          if (generationRef.current !== generation) {
            return;
          }
          const nextError =
            error instanceof Error
              ? error
              : new Error("Failed to load collection group data.");
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: nextError,
          }));
        }
      },
      [accessor, pageSize],
    );

    useEffect(() => {
      lastDocRef.current = null;

      if (!enabled) {
        setState(emptyState);
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
      void loadPage(true);
    }, [enabled, clientFilter, loadPage, queryKey]);

    const fetchMore = useCallback(() => {
      if (state.isLoading || !state.hasMore) {
        return;
      }
      void loadPage(false);
    }, [loadPage, state.hasMore, state.isLoading]);

    const refresh = useCallback(() => {
      if (!enabled) {
        return;
      }
      lastDocRef.current = null;
      setState({
        items: [],
        hasMore: true,
        isLoading: true,
        filteredCount: 0,
        scannedCount: 0,
        error: undefined,
      });
      void loadPage(true);
    }, [enabled, loadPage]);

    return {
      ...state,
      fetchMore,
      refresh,
    };
  };
}
