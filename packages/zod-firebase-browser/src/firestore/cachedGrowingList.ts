import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import {
  hierarchicalWeakCache,
  parseJsonString,
  retentionCache,
  stableStringify,
} from "@zodapp/caching-utilities";
import type { RetentionCache } from "@zodapp/caching-utilities";
import type { z } from "zod";
import firebase from "firebase/compat/app";
import type { AccessorStoreKey } from ".";
import {
  createIntrinsicGrowingList,
  type IntrinsicGrowingList,
} from "./intrinsitGrowingList";

type Firestore = firebase.firestore.Firestore;
type WhereFilterOp = firebase.firestore.WhereFilterOp;
type GrowingListCacheKeys = readonly [
  Firestore,
  AccessorStoreKey,
  CollectionConfigBase,
];

// インスタンス破棄までの保持時間（10分）
const RETENTION_TIME = 600_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const growingListCache = hierarchicalWeakCache<
  GrowingListCacheKeys,
  RetentionCache<string, IntrinsicGrowingList<any>>
>();

type CacheKey = {
  collectionIdentityParams: Record<string, string>;
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
  };
  streamField: string;
  streamQuery?: {
    where?: {
      field: string;
      operator: WhereFilterOp;
      value: unknown;
    }[];
  };
};

function getOrCreateCache<TConfig extends CollectionConfigBase>(
  db: Firestore,
  config: TConfig,
  storeKey: AccessorStoreKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): RetentionCache<string, IntrinsicGrowingList<any>> {
  return growingListCache.getOrCreate([db, storeKey, config], () =>
    retentionCache<string, IntrinsicGrowingList<any>>({
      factory: (serializedKey: string) => {
        const key = parseJsonString(serializedKey) as CacheKey;
        for (const where of key.query?.where ?? []) {
          if (
            typeof where.value === "string" &&
            where.value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
          ) {
            where.value = new Date(where.value);
          }
        }

        return createIntrinsicGrowingList(
          db,
          config,
          storeKey,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          key.collectionIdentityParams as z.infer<
            TConfig["collectionIdentitySchema"]
          >,
          key.query,
          key.streamField,
          key.streamQuery,
        );
      },
      dispose: (instance) => {
        instance.dispose();
      },
      serializer: (key: string) => key,
      retentionTime: RETENTION_TIME,
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CachedGrowingList<TConfig extends CollectionConfigBase = any> =
  IntrinsicGrowingList<TConfig> & {
    /** キャッシュからの参照を解放する */
    release: () => void;
  };

/**
 * キャッシュされた IntrinsicGrowingList インスタンスを取得する
 *
 * - 同じパラメータで複数回呼び出しても同じインスタンスが返される
 * - release() を呼び出すと参照カウントが減り、全ての参照が解放されてから 10 分後にインスタンスが破棄される
 * - インスタンスは subscribe がなくなってから 3 秒後に upstream を停止し、再度 subscribe されると再開する
 */
export function createCachedGrowingList<TConfig extends CollectionConfigBase>(
  db: Firestore,
  config: TConfig,
  storeKey: AccessorStoreKey,
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
): CachedGrowingList<TConfig> {
  const cache = getOrCreateCache(db, config, storeKey);

  const cacheKey: CacheKey = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    collectionIdentityParams: collectionIdentityParams as Record<
      string,
      string
    >,
    query,
    streamField,
    streamQuery,
  };
  const serializedKey = stableStringify(cacheKey);

  const { instance, release } = cache.acquire(serializedKey);

  return {
    ...instance,
    release,
  };
}
