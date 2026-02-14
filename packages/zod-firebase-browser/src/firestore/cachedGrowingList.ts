import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import { retentionCache, stableStringify } from "@zodapp/caching-utilities";
import type { RetentionCache } from "@zodapp/caching-utilities";
import type { z } from "zod";
import firebase from "firebase/compat/app";
import {
  createIntrinsicGrowingList,
  type IntrinsicGrowingList,
} from "./intrinsitGrowingList";

type Firestore = firebase.firestore.Firestore;
type WhereFilterOp = firebase.firestore.WhereFilterOp;

// インスタンス破棄までの保持時間（10分）
const RETENTION_TIME = 600_000;

// CollectionConfig ごとの RetentionCache を管理する WeakMap
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configToCacheMap = new WeakMap<
  CollectionConfigBase,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): RetentionCache<string, IntrinsicGrowingList<any>> {
  const existingCache = configToCacheMap.get(config);
  if (existingCache) {
    return existingCache;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newCache = retentionCache<string, IntrinsicGrowingList<any>>({
    factory: (serializedKey: string) => {
      const key = JSON.parse(serializedKey) as CacheKey;
      return createIntrinsicGrowingList(
        db,
        config,
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
  });

  configToCacheMap.set(config, newCache);
  return newCache;
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
  const cache = getOrCreateCache(db, config);

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
