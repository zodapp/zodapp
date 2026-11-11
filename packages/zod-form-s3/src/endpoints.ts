/**
 * サーバーの署名付き URL のエンドポイント（`@zodapp/zod-form-s3-node` の `createS3FileRouter`）を呼ぶ関数。
 */

/** アップロードの URL を求める */
export type RequestUploadUrl = (request: {
  prefix: string;
  contentType: string;
}) => Promise<{ key: string; url: string }>;

/** ダウンロードの URL を求める */
export type RequestDownloadUrl = (key: string) => Promise<{ url: string }>;

/** 削除する */
export type RequestDelete = (key: string) => Promise<void>;

export type S3FileEndpoints = {
  requestUploadUrl: RequestUploadUrl;
  requestDownloadUrl: RequestDownloadUrl;
  requestDelete?: RequestDelete;
};

export type HttpS3FileEndpointsOptions = {
  /** エンドポイントの前に付ける URL（例：`"/api"`）。既定は `""` */
  baseUrl?: string;
  /** 送るヘッダー（認証のトークンなど）。呼ぶたびに作る */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** パス。既定はサーバーの既定と同じ */
  paths?: { upload?: string; download?: string; delete?: string };
  /** 削除のエンドポイントを使うか。既定は false（サーバーで削除を公開した場合だけ true） */
  enableDelete?: boolean;
  fetch?: typeof fetch;
};

/** サーバーの既定のパス（`@zodapp/zod-form-s3-node` と揃える） */
export const DEFAULT_S3_FILE_PATHS = {
  upload: "/files/upload-url",
  download: "/files/download-url",
  delete: "/files/delete",
} as const;

/** HTTP でサーバーのエンドポイントを呼ぶ */
export const httpS3FileEndpoints = (
  options: HttpS3FileEndpointsOptions = {},
): S3FileEndpoints => {
  const base = options.baseUrl ?? "";
  const paths = { ...DEFAULT_S3_FILE_PATHS, ...options.paths };
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const call = async <T>(path: string, body: unknown): Promise<T> => {
    const headers = (await options.headers?.()) ?? {};
    const res = await doFetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  return {
    requestUploadUrl: (request) => call(paths.upload, request),
    requestDownloadUrl: (key) => call(paths.download, { key }),
    ...(options.enableDelete
      ? {
          requestDelete: async (key: string) => {
            await call(paths.delete, { key });
          },
        }
      : {}),
  };
};
