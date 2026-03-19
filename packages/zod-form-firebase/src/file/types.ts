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
 * contextId は resolverContext のどの部分を使うかの識別子。
 * getLocation は resolverContext を受けて保存先を決定する。
 */
export type FirebaseStorageFileConfigCore = BaseFileConfigCore & {
  contextId: string;
  getLocation: (context: Record<string, unknown>) => FirebaseStorageLocation;
};

/**
 * Firebase Storage用ファイル設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 */
export type FirebaseStorageFileConfig<
  TType extends string = "firebaseStorage",
> = BaseFileConfig<TType> & FirebaseStorageFileConfigCore;
