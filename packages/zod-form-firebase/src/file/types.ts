/**
 * Firebase Storage ファイル解決のための型定義
 */

import type {
  BaseFileConfig,
  BaseFileConfigCore,
} from "@zodapp/zod-form/file/types";

/**
 * Firebase Storageのロケーション設定
 */
export type FirebaseStorageLocation = {
  bucket?: string;
  parentPath: string;
};

/**
 * Firebase Storage用ファイル設定（type除外版）
 * 実装固有のフィールドのみ定義
 *
 * TContextId: contextId のリテラル型（"team", "workspace" 等）
 * TContext: contextId に対応する runtime context の型
 *
 * contextId は resolverContext のどの部分を使うかの識別子。
 * getLocation は対応する context slice を受けて保存先を決定する。
 */
export type FirebaseStorageFileConfigCore<
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = BaseFileConfigCore & {
  contextId: TContextId;
  getLocation: (context: TContext) => FirebaseStorageLocation;
};

/**
 * Firebase Storage用ファイル設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 * TContextId / TContext で contextId と対応する context 型を連動させる
 */
export type FirebaseStorageFileConfig<
  TType extends string = "firebaseStorage",
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = BaseFileConfig<TType> & FirebaseStorageFileConfigCore<TContextId, TContext>;
