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
  FirestoreConditionContextMap,
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
 * conditions は conditionId をキーとする context map。
 * query 生成は externalKeyConfig.getQuery に委譲する。
 *
 * @param type - ResolverのID（デフォルト: "firestore"）
 * @param db - Firestoreインスタンス
 * @param conditions - condition context map（conditionIdをキーとする）
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
  conditions: FirestoreConditionContextMap;
}): ExternalKeyResolverEntry<TType, FirestoreExternalKeyConfigCore> {
  return {
    type,
    resolver: (config: FirestoreExternalKeyConfig<TType>) => {
      const context = conditions[config.conditionId];

      if (!context) {
        throw new Error(
          `conditionId "${config.conditionId}" not found in conditions`,
        );
      }

      const { labelField, labelFormatter, valueField } = config.reference.config;
      const resolvedValueField =
        valueField ?? config.reference.collection.documentKey;

      const resolveLabel = (doc: unknown): string => {
        const record = doc as unknown as Record<string, unknown>;
        if (typeof labelFormatter === "function") {
          return labelFormatter(record);
        }
        if (typeof labelField === "string") {
          return String(record[labelField]);
        }
        return String(record[resolvedValueField]);
      };

      const resolved = config.getQuery("", context);
      const collectionIdentityKeys =
        config.reference.collection.collectionIdentityKeys as readonly string[];
      const identityParams = Object.fromEntries(
        collectionIdentityKeys
          .filter((key) => key in context)
          .map((key) => [key, String(context[key])]),
      );
      const queryOptions = { where: resolved.where ?? [] };

      return {
        subscribe: (callback: ExternalKeyOptionsHandler) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const accessor = getAccessor(
            db,
            config.reference.collection as unknown as CollectionConfigBase,
            storeKey,
          );

          return accessor.querySync(
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
            identityParams as any,
            queryOptions,
            (docs) => {
              const options = docs.map((doc) => ({
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
