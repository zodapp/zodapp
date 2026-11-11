import type {
  BaseFileConfigCore,
  FileResolverEntry,
} from "@zodapp/zod-form/file/types";
import {
  getRequiredResolverContextSlice,
  type RegisteredResolverContext,
} from "@zodapp/zod-form/resolverContext";
import type { S3FileEndpoints } from "./endpoints";
import { keyOfStoredUrl, toStoredUrl } from "./storedUrl";
import type { S3FileConfigCore } from "./types";

/** Resolver が受け取る設定（resolverContext の型はアプリが決めるので、ここでは問わない） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolverConfig = BaseFileConfigCore & S3FileConfigCore<string, any>;

export type S3FileResolverOptions<TType extends string> = S3FileEndpoints & {
  /** 設定の `type`。既定は `"s3"` */
  type?: TType;
  /** S3 への PUT に使う fetch */
  fetch?: typeof fetch;
};

const contentTypeOf = (file: File) => file.type || "application/octet-stream";

/**
 * ファイルの Resolver。サーバーが発行した署名付き URL に、ブラウザが S3 へ直接 PUT する。
 * 保存する値は `s3:///{key}?mimeType=...`。
 *
 * ```ts
 * const resolvers = [
 *   createS3FileResolver(httpS3FileEndpoints({ baseUrl: "/api", headers: authHeaders })),
 * ];
 * ```
 */
export const createS3FileResolver = <TType extends string = "s3">(
  options: S3FileResolverOptions<TType>,
): FileResolverEntry<TType, ResolverConfig> => {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    type: (options.type ?? "s3") as TType,
    resolver: (config, resolverContext: RegisteredResolverContext) => {
      const context = getRequiredResolverContextSlice<unknown>(
        resolverContext,
        config.contextId,
      );
      const { prefix } = config.getLocation(context);
      return {
        upload: async (file: File) => {
          const contentType = contentTypeOf(file);
          const { key, url } = await options.requestUploadUrl({ prefix, contentType });
          const res = await doFetch(url, {
            method: "PUT",
            body: file,
            headers: { "content-type": contentType },
          });
          if (!res.ok) throw new Error(`upload failed: ${res.status}`);
          return { url: toStoredUrl(key, contentType) };
        },
        getDownloadUrl: (storedUrl: string) =>
          options.requestDownloadUrl(keyOfStoredUrl(storedUrl)),
        ...(options.requestDelete
          ? {
              delete: (storedUrl: string) =>
                options.requestDelete!(keyOfStoredUrl(storedUrl)),
            }
          : {}),
      };
    },
  };
};
