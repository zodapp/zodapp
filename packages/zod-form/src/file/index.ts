/**
 * ファイル解決のためのエクスポート
 */

// ResolverId はexternalKeyからもエクスポートされているため、ここでは除外
export type {
  FileUploadResult,
  FileDownloadResult,
  FileResolverResult,
  BaseFileConfigCore,
  BaseFileConfig,
  FileResolverEntry,
  FileResolvers,
  FileConfig,
  FileConfigRegistry,
  RegisteredFileConfig,
} from "./types";

export { parseMimeTypeFromUrl } from "./utils";

export { createMockFileResolver } from "./mock";

// Note: MediaResolver関連は @zodapp/zod-form-react/media からimportしてください
