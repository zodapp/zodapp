/**
 * Firestore外部キー解決のための型定義
 */

import type {
  LooseCollectionReferenceBase,
  WhereParams,
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
  conditionId: string; // 必須（defaultは廃止）
};

/**
 * Firestore外部キー設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 */
export type FirestoreExternalKeyConfig<TType extends string = "firestore"> =
  BaseExternalKeyConfig<TType> & FirestoreExternalKeyConfigCore;

/**
 * 絞り込み条件（resolver生成時に注入）
 */
export type FirestoreCondition = {
  /** querySyncの第1引数（collectionIdentityParams）に渡す */
  identityParams: Record<string, string>;
  /** where条件 */
  where?: WhereParams[];
  /** クライアントサイドでの追加フィルタ */
  filter?: (doc: unknown) => boolean;
};

/**
 * 条件群（conditionIdをキーとする）
 */
export type FirestoreConditions = Record<string, FirestoreCondition>;
