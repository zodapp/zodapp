/**
 * ファイルの項目（zf.file）を S3 に保存する設定（@zodapp/zod-form-s3）。
 * アップロードとダウンロードの署名付き URL は、サーバーの /api/files が発行する
 * （@zodapp/zod-form-s3-node の createS3FileRouter）。
 */
import type { S3FileConfig as BaseS3FileConfig } from "@zodapp/zod-form-s3";
import type {
  AppResolverContextId,
  AppResolverContextMap,
} from "./resolverContext";

export type S3FileConfig = {
  [K in AppResolverContextId]: BaseS3FileConfig<"s3", K, AppResolverContextMap[K]>;
}[AppResolverContextId];

declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: S3FileConfig;
  }
}
