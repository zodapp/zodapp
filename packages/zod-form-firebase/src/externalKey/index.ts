/**
 * Firestore外部キーResolver
 */

import type {
  ExternalKeyResolverEntry,
  ExternalKeyOptionsHandler,
} from "@zodapp/zod-form/externalKey/types";
import type {
  FirestoreExternalKeyConfig,
  FirestoreExternalKeyConfigCore,
  FirestoreConditions,
} from "./types";
import type { CollectionConfigBase } from "@zodapp/zod-firebase";
import {
  getAccessor,
  type AccessorStoreKey,
} from "@zodapp/zod-firebase-browser";
import firebase from "firebase/compat/app";

type Firestore = firebase.firestore.Firestore;

/**
 * Firestore用の外部キーResolverEntryを生成する
 *
 * キャッシュはquerySyncに委譲する。querySyncは内部でsubscriptionCacheを使用しており、
 * 同じ{ collectionIdentityParams, queryParams }に対してFirestore subscriptionを共有する。
 *
 * @param type - ResolverのID（デフォルト: "firestore"）
 * @param db - Firestoreインスタンス
 * @param conditions - 絞り込み条件群（conditionIdをキーとする）
 */
export function createFirestoreResolver<TType extends string = "firestore">({
  type = "firestore" as TType,
  db,
  storeKey,
  conditions,
}: {
  type?: TType;
  db: Firestore;
  storeKey: AccessorStoreKey;
  conditions: FirestoreConditions;
}): ExternalKeyResolverEntry<TType, FirestoreExternalKeyConfigCore> {
  return {
    type,
    resolver: (config: FirestoreExternalKeyConfig<TType>) => {
      const condition = conditions[config.conditionId];

      if (!condition) {
        throw new Error(
          `conditionId "${config.conditionId}" not found in conditions`,
        );
      }

      const { label, valueField } = config.reference.lookupConfig;
      const resolvedValueField =
        valueField ?? config.reference.collection.documentKey;

      const resolveLabel = (doc: unknown): string => {
        const record = doc as unknown as Record<string, unknown>;
        if (typeof label === "function") {
          return label(record);
        }
        if (typeof label === "string") {
          return String(record[label]);
        }
        return String(record[resolvedValueField]);
      };

      return {
        subscribe: (callback: ExternalKeyOptionsHandler) => {
          // LooseCollectionReferenceBase.collection は CollectionConfigBase と互換性があるが、
          // 型定義上は $replace 回避のため緩い型を使用しているため、キャストが必要
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const accessor = getAccessor(
            db,
            config.reference.collection as unknown as CollectionConfigBase,
            storeKey,
          );

          // querySyncが内部でsubscriptionCacheを使ってキャッシュ
          // 同じpathParams + whereのクエリはFirestore subscriptionを共有
          return accessor.querySync(
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
            condition.identityParams as any,
            { where: condition.where ?? [] },
            (docs) => {
              // filterはキャッシュ外（callback内）で適用
              const filtered = condition.filter
                ? docs.filter(condition.filter)
                : docs;

              const options = filtered.map((doc) => ({
                label: resolveLabel(doc),
                value: String(
                  (doc as unknown as Record<string, unknown>)[
                    resolvedValueField
                  ],
                ),
              }));

              callback(options);
            },
          );
        },
      };
    },
  };
}
