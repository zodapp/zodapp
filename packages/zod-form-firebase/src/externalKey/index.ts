/**
 * Firestore外部キーResolver
 */

import type {
  ExternalKeyResolverEntry,
  ExternalKeyOptionsHandler,
} from "@zodapp/zod-form/externalKey/types";
import {
  getRequiredResolverContextSlice,
  type RegisteredResolverContext,
} from "@zodapp/zod-form/resolverContext";
import type {
  FirestoreExternalKeyConfig,
  FirestoreExternalKeyConfigCore,
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
 * resolverContext は RegisteredResolverContext（Partial<RegisteredResolverContextMap>）を受け、
 * config.contextId に対応する slice を取り出して getQuery に渡す。
 * 必須 slice が存在しない場合はエラーとする。
 *
 * @param type - ResolverのID（デフォルト: "firestore"）
 * @param db - Firestoreインスタンス
 */
export function createFirestoreResolver<TType extends string = "firestore">({
  type = "firestore" as TType,
  db,
  storeKey,
}: {
  type?: TType;
  db: Firestore;
  storeKey: AccessorStoreKey;
}): ExternalKeyResolverEntry<TType, FirestoreExternalKeyConfigCore> {
  return {
    type,
    resolver: (
      config: FirestoreExternalKeyConfig<TType>,
      resolverContext: RegisteredResolverContext,
    ) => {
      const ctx = getRequiredResolverContextSlice<
        Parameters<typeof config.getQuery>[1]
      >(resolverContext, config.contextId);
      const { labelField, labelFormatter, valueField } =
        config.reference.config;
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

      const resolved = config.getQuery("", ctx);
      const collectionIdentityKeys = config.reference.collection
        .collectionIdentityKeys as readonly string[];
      const identityParams =
        config.getCollectionIdentity?.(ctx) ??
        Object.fromEntries(
          collectionIdentityKeys
            .filter((key) => key in ctx)
            .map((key) => [key, String(ctx[key])]),
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
