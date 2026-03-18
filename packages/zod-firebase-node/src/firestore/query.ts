import {
  type CollectionConfigBase,
  type QueryFn,
  type QueryOptions,
} from "@zodapp/zod-firebase";
import type { z } from "zod";
import { firestore } from "firebase-admin";
import { getAccessor } from "./collection";

type DocumentSnapshot = firestore.DocumentSnapshot;
type QuerySnapshot<T = firestore.DocumentData> = firestore.QuerySnapshot<T>;
type Firestore = firestore.Firestore;

// 型ユーティリティ
type IsAny<T> = 0 extends 1 & T ? true : false;

/** accessor にバインドされた queries の型（各 query に get / getSnapshot / sync / syncSnapshot / params） */
type BoundQueries<
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
> =
  IsAny<TQueries> extends true
    ? Record<string, never>
    : [keyof TQueries] extends [never]
      ? Record<string, never>
      : {
          [K in keyof TQueries]: {
            get: (
              collectionId: z.infer<TCollection["collectionIdentitySchema"]>,
              ...args: Parameters<TQueries[K]>
            ) => Promise<z.infer<TCollection["dataSchema"]>[]>;
            getSnapshot: (
              collectionId: z.infer<TCollection["collectionIdentitySchema"]>,
              ...args: Parameters<TQueries[K]>
            ) => Promise<DocumentSnapshot[]>;
            sync: (
              collectionId: z.infer<TCollection["collectionIdentitySchema"]>,
              ...args: [
                ...Parameters<TQueries[K]>,
                (data: z.infer<TCollection["dataSchema"]>[]) => void,
              ]
            ) => () => void;
            syncSnapshot: (
              collectionId: z.infer<TCollection["collectionIdentitySchema"]>,
              ...args: [
                ...Parameters<TQueries[K]>,
                (snapshot: QuerySnapshot<z.infer<TCollection["dataSchema"]>>) => void,
              ]
            ) => () => void;
            params: (...args: Parameters<TQueries[K]>) => QueryOptions;
          };
        };

type QueriesAccessorResult<
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
> = BoundQueries<TCollection, TQueries>;

const queryAccessorDbCache = new WeakMap<Firestore, WeakMap<object, unknown>>();

const getQueriesAccessorCached = <
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
>(
  db: Firestore,
  config: { collection: TCollection; queries: TQueries },
): QueriesAccessorResult<TCollection, TQueries> => {
  const cacheForDB =
    queryAccessorDbCache.get(db) ??
    (() => {
      const accessorCache = new WeakMap<object, unknown>();
      queryAccessorDbCache.set(db, accessorCache);
      return accessorCache;
    })();
  const accessor =
    cacheForDB.get(config) ??
    (() => {
      const newAccessor = getQueriesAccessorInternal(db, config);
      cacheForDB.set(config, newAccessor);
      return newAccessor;
    })();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return accessor as QueriesAccessorResult<TCollection, TQueries>;
};

const getQueriesAccessorInternal = <
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
>(
  db: Firestore,
  config: { collection: TCollection; queries: TQueries },
) => {
  type _DataType = z.infer<TCollection["dataSchema"]>;
  type CollIdentityParams = z.infer<TCollection["collectionIdentitySchema"]>;
  const accessor = getAccessor(db, config.collection);
  return Object.fromEntries(
    Object.entries(config.queries).map(([name, queryFn]) => [
      name,
      {
        get: async (
          collectionId: CollIdentityParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...args: any[]
        ) => {
          const queryParams = (queryFn as QueryFn)(...args);
          return accessor.query(collectionId, queryParams);
        },
        getSnapshot: async (
          collectionId: CollIdentityParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...args: any[]
        ) => {
          const queryParams = (queryFn as QueryFn)(...args);
          return accessor.querySnapshot(collectionId, queryParams);
        },
        sync: (
          collectionId: CollIdentityParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...argsAndCallback: any[]
        ) => {
          const callback = argsAndCallback.pop() as (data: _DataType[]) => void;
          const args = argsAndCallback;
          const queryParams = (queryFn as QueryFn)(...args);
          return accessor.querySync(collectionId, queryParams, callback);
        },
        syncSnapshot: (
          collectionId: CollIdentityParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...argsAndCallback: any[]
        ) => {
          const callback = argsAndCallback.pop() as (
            snapshot: QuerySnapshot<_DataType>,
          ) => void;
          const args = argsAndCallback;
          const queryParams = (queryFn as QueryFn)(...args);
          return accessor.querySnapshotSync(collectionId, queryParams, callback);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: (...args: any[]) => (queryFn as QueryFn)(...args),
      },
    ]),
  );
};

export const getQueriesAccessor = getQueriesAccessorCached;
