/**
 * ファイル解決のための共通型定義
 */

/** ResolverのID（"firebaseStorage"など） */
export type ResolverId = string;

/**
 * ファイルアップロード結果
 */
export type FileUploadResult = {
  url: string; // 保存先URL（mimeTypeをsearchParamsに含む）
};

/**
 * ファイルダウンロード結果
 */
export type FileDownloadResult = {
  url: string; // signedURL（直接アクセス可能なURL）
};

/**
 * Resolver実行結果
 * アップロード・ダウンロード両方を提供
 */
export type FileResolverResult = {
  upload: (file: File) => Promise<FileUploadResult>;
  getDownloadUrl: (storedUrl: string) => Promise<FileDownloadResult>;
  delete?: (storedUrl: string) => Promise<void>; // オプション
};

/**
 * ファイル設定の基底型（type除外版）
 * 各実装パッケージで拡張して使用する
 */
export type BaseFileConfigCore = {
  mimeTypes?: string[]; // 受け入れ可能なmimeType（Dropzoneのaccept用）
  maxSize?: number; // 最大ファイルサイズ（バイト単位）、デフォルト5MB (5 * 1024 ** 2)
};

/**
 * ファイル設定の基底型（type込み）
 */
export type BaseFileConfig<TType extends ResolverId = ResolverId> = {
  type: TType;
} & BaseFileConfigCore;

/**
 * Resolver Entry（配列登録用）
 * typeをResolver側で持つことで、登録キーとconfig.typeの一致を構造的に保証
 */
export type FileResolverEntry<
  TType extends ResolverId = ResolverId,
  TConfig extends BaseFileConfigCore = BaseFileConfigCore,
> = {
  type: TType;
  resolver: (config: TConfig & { type: TType }) => FileResolverResult;
};

/**
 * Resolvers（配列形式）
 * Entryのtype がSoTとなり、config.type との一致を保証
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FileResolvers = FileResolverEntry<any, any>[];

/**
 * ファイル設定
 * 直接指定またはrender時に解決する関数形式をサポート
 */
export type FileConfig<TConfig extends BaseFileConfig = BaseFileConfig> =
  | TConfig
  | (() => TConfig);

// === 案3: declare module 用の型拡張ポイント ===

/**
 * ファイル設定のレジストリ（アプリ側で declare module で拡張）
 *
 * 使用例:
 * declare module "@zodapp/zod-form/file/types" {
 *   interface FileConfigRegistry {
 *     config: WebFileConfig;
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FileConfigRegistry {}

/**
 * 登録済みのファイル設定型
 * - FileConfigRegistry に config が登録されていればその型を使用
 * - 未登録なら BaseFileConfig にフォールバック
 */
export type RegisteredFileConfig = FileConfigRegistry extends {
  config: infer T;
}
  ? T
  : BaseFileConfig;
