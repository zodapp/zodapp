import {
  type CollectionConfigBase,
  type QueryFn,
  type QueryOptions,
} from "@zodapp/zod-firebase";
import { hierarchicalWeakCache } from "@zodapp/caching-utilities";
import type { z } from "zod";
import firebase from "firebase/compat/app";
import {
  getAccessor,
  queryBuilder,
  type AccessorStoreKey,
} from "./collection";

type DocumentSnapshot = firebase.firestore.DocumentSnapshot;
type QuerySnapshot<T = firebase.firestore.DocumentData> =
  firebase.firestore.QuerySnapshot<T>;
type Firestore = firebase.firestore.Firestore;
type QueryAccessorCacheKeys = readonly [Firestore, AccessorStoreKey, object];

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

const queryAccessorCache =
  hierarchicalWeakCache<QueryAccessorCacheKeys, unknown>();

const getQueriesAccessorCached = <
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
>(
  db: Firestore,
  config: { collection: TCollection; queries: TQueries },
  storeKey: AccessorStoreKey,
): QueriesAccessorResult<TCollection, TQueries> => {
  const accessor = queryAccessorCache.getOrCreate([db, storeKey, config], () =>
    getQueriesAccessorInternal(db, config, storeKey),
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return accessor as QueriesAccessorResult<TCollection, TQueries>;
};

const getQueriesAccessorInternal = <
  TCollection extends CollectionConfigBase,
  TQueries extends Record<string, QueryFn>,
>(
  db: Firestore,
  config: { collection: TCollection; queries: TQueries },
  storeKey: AccessorStoreKey,
) => {
  type _DataType = z.infer<TCollection["dataSchema"]>;
  type CollIdentityParams = z.infer<TCollection["collectionIdentitySchema"]>;
  const accessor = getAccessor(db, config.collection, storeKey);
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
          return accessor.query(collectionId, queryBuilder(queryParams));
        },
        getSnapshot: async (
          collectionId: CollIdentityParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...args: any[]
        ) => {
          const queryParams = (queryFn as QueryFn)(...args);
          return accessor.querySnapshot(collectionId, queryBuilder(queryParams));
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
