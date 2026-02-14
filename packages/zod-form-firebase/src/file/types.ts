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
  bucket?: string; // オプション、省略時はデフォルトバケット
  parentPath: string; // ファイルを保存するディレクトリパス
};

/**
 * ロケーション群（storageLocationIdをキーとする）
 */
export type FirebaseStorageLocations = Record<string, FirebaseStorageLocation>;

/**
 * Firebase Storage用ファイル設定（type除外版）
 * 実装固有のフィールドのみ定義
 */
export type FirebaseStorageFileConfigCore = BaseFileConfigCore & {
  storageLocationId: string; // locationsのキーと対応
};

/**
 * Firebase Storage用ファイル設定（type込み）
 * TTypeはResolverEntry.typeと一致する
 */
export type FirebaseStorageFileConfig<
  TType extends string = "firebaseStorage",
> = BaseFileConfig<TType> & FirebaseStorageFileConfigCore;
