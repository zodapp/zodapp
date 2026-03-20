import { type CollectionConfigBase } from "@zodapp/zod-firebase";
import { hierarchicalWeakCache } from "@zodapp/caching-utilities";
import type { z } from "zod";
import firebase from "firebase/compat/app";
import { getAccessor, type AccessorStoreKey } from "./collection";

type Firestore = firebase.firestore.Firestore;
type MutationAccessorCacheKeys = readonly [Firestore, AccessorStoreKey, object];

// 型ユーティリティ
type IsAny<T> = 0 extends 1 & T ? true : false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutationRecord = Record<string, (...args: any[]) => unknown>;

/** accessor にバインドされた mutations の型（docIdentityParams を第一引数に挿入） */
type BoundMutations<
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
> =
  IsAny<TMutations> extends true
    ? Record<string, never>
    : [keyof TMutations] extends [never]
      ? Record<string, never>
      : {
          [K in keyof TMutations]: (
            docIdentityParams: z.infer<TCollection["documentIdentitySchema"]>,
            ...args: Parameters<TMutations[K]>
          ) => Promise<void>;
        };

type MutationsAccessorResult<
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
> = BoundMutations<TCollection, TMutations>;

const mutationAccessorCache = hierarchicalWeakCache<
  MutationAccessorCacheKeys,
  unknown
>();

const getMutationsAccessorCached = <
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
>(
  db: Firestore,
  config: { collection: TCollection; mutations: TMutations },
  storeKey: AccessorStoreKey,
): MutationsAccessorResult<TCollection, TMutations> => {
  const accessor = mutationAccessorCache.getOrCreate(
    [db, storeKey, config],
    () => getMutationsAccessorInternal(db, config, storeKey),
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return accessor as MutationsAccessorResult<TCollection, TMutations>;
};

const getMutationsAccessorInternal = <
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
>(
  db: Firestore,
  config: { collection: TCollection; mutations: TMutations },
  storeKey: AccessorStoreKey,
) => {
  type DocIdentityParams = z.infer<TCollection["documentIdentitySchema"]>;
  const accessor = getAccessor(db, config.collection, storeKey);
  return Object.fromEntries(
    Object.entries(config.mutations).map(([name, mutationFn]) => [
      name,
      async (
        identityKey: DocIdentityParams,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...args: any[]
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData = (mutationFn as any)(...args);
        await accessor.updateDoc(identityKey, updateData);
      },
    ]),
  );
};

export const getMutationsAccessor = getMutationsAccessorCached;
