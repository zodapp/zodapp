/**
 * ファイルの項目（zf.file）を S3 に保存する設定。
 * アップロードとダウンロードの署名付き URL は、サーバー（`@zodapp/zod-form-s3-node`）が発行する。
 */
import type { BaseFileConfig } from "@zodapp/zod-form";

/** 実装固有のフィールド（type を除く） */
export type S3FileConfigCore<
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = {
  /** resolverContext のどの部分を使うか */
  contextId: TContextId;
  /** 保存先の接頭辞を決める。サーバーは、接頭辞（キー）から読み書きの認可をする */
  getLocation: (context: TContext) => { prefix: string };
};

/**
 * S3 のファイルの設定（type 込み）。アプリは `declare module` で登録して使う。
 *
 * ```ts
 * declare module "@zodapp/zod-form/file/types" {
 *   interface FileConfigRegistry {
 *     config: S3FileConfig<"s3", "workspace", { workspaceId: string }>;
 *   }
 * }
 * ```
 */
export type S3FileConfig<
  TType extends string = "s3",
  TContextId extends string = string,
  TContext = Record<string, unknown>,
> = BaseFileConfig<TType> & S3FileConfigCore<TContextId, TContext>;
