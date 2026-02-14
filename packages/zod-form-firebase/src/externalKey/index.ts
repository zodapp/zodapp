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
import { getAccessor } from "@zodapp/zod-firebase-browser";
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
  conditions,
}: {
  type?: TType;
  db: Firestore;
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

      if (!config.collectionConfig.externalKeyConfig) {
        throw new Error(`externalKeyConfig is not defined in collectionConfig`);
      }

      const { labelField, valueField } =
        config.collectionConfig.externalKeyConfig;

      return {
        subscribe: (callback: ExternalKeyOptionsHandler) => {
          // LooseCollectionConfigBase は CollectionConfigBase と互換性があるが、
          // 型定義上は $replace 回避のため緩い型を使用しているため、キャストが必要
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const accessor = getAccessor(
            db,
            config.collectionConfig as unknown as CollectionConfigBase,
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
                label: String(
                  (doc as unknown as Record<string, unknown>)[labelField],
                ),
                value: String(
                  (doc as unknown as Record<string, unknown>)[valueField],
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
