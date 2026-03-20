import { type CollectionConfigBase } from "@zodapp/zod-firebase";
import type { z } from "zod";
import { firestore } from "firebase-admin";
import { getAccessor } from "./collection";

type Firestore = firestore.Firestore;

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

const mutationAccessorDbCache = new WeakMap<
  Firestore,
  WeakMap<object, unknown>
>();

const getMutationsAccessorCached = <
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
>(
  db: Firestore,
  config: { collection: TCollection; mutations: TMutations },
): MutationsAccessorResult<TCollection, TMutations> => {
  const cacheForDB =
    mutationAccessorDbCache.get(db) ??
    (() => {
      const accessorCache = new WeakMap<object, unknown>();
      mutationAccessorDbCache.set(db, accessorCache);
      return accessorCache;
    })();
  const accessor =
    cacheForDB.get(config) ??
    (() => {
      const newAccessor = getMutationsAccessorInternal(db, config);
      cacheForDB.set(config, newAccessor);
      return newAccessor;
    })();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return accessor as MutationsAccessorResult<TCollection, TMutations>;
};

const getMutationsAccessorInternal = <
  TCollection extends CollectionConfigBase,
  TMutations extends MutationRecord,
>(
  db: Firestore,
  config: { collection: TCollection; mutations: TMutations },
) => {
  type DocIdentityParams = z.infer<TCollection["documentIdentitySchema"]>;
  const accessor = getAccessor(db, config.collection);
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
