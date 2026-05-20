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
 * TContextId: contextId のリテラル型（"team", "workspace" 等）
 * TContext: contextId に対応する runtime context の型
 *
 * 注意: reference は LooseCollectionReferenceBase を使用
 * これは Zod の $replace による型展開を回避するため
 * createCollectionReference() で生成された値を受け入れる
 */
export type FirestoreExternalKeyConfigCore<
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = {
  reference: LooseCollectionReferenceBase;
  contextId: TContextId;
  getQuery: (value: string, context: TContext) => QueryOptions;
  getCollectionIdentity?: (context: TContext) => Record<string, string>;
};

/**
 * Firestore外部キー設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 * TContextId / TContext で contextId と対応する context 型を連動させる
 */
export type FirestoreExternalKeyConfig<
  TType extends string = "firestore",
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = BaseExternalKeyConfig<TType> &
  FirestoreExternalKeyConfigCore<TContextId, TContext>;
