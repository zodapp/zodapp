/**
 * Firestore外部キー解決のための型定義
 */

import type {
  LooseCollectionReferenceBase,
  QueryOptions,
} from "@zodapp/zod-firebase";
import type { BaseExternalKeyConfig } from "@zodapp/zod-form/externalKey/types";

/**
 * Firestore外部キー設定（type除外版）
 * 実装固有のフィールドのみ定義
 *
 * 注意: reference は LooseCollectionReferenceBase を使用
 * これは Zod の $replace による型展開を回避するため
 * createCollectionReference() で生成された値を受け入れる
 */
export type FirestoreExternalKeyConfigCore = {
  reference: LooseCollectionReferenceBase;
  conditionId: string;
  getQuery: (value: string, context: Record<string, unknown>) => QueryOptions;
};

/**
 * Firestore外部キー設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 */
export type FirestoreExternalKeyConfig<TType extends string = "firestore"> =
  BaseExternalKeyConfig<TType> & FirestoreExternalKeyConfigCore;

/**
 * condition context map（conditionId をキーとする）
 *
 * 画面側は context のみを渡し、query 生成は externalKeyConfig.getQuery に委譲する。
 */
export type FirestoreConditionContextMap = Record<
  string,
  Record<string, unknown>
>;
