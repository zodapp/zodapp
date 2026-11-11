/**
 * zod-form の Resolver（外部キーの選択肢とファイル）。
 * 外部キーは登録簿のクエリ（@zodapp/zod-form-dynamodb）、ファイルは S3（@zodapp/zod-form-s3）。
 */
import { createDynamoExternalKeyResolver as createExternalKeyResolver } from "@zodapp/zod-form-dynamodb";
import {
  createS3FileResolver as createFileResolver,
  httpS3FileEndpoints,
} from "@zodapp/zod-form-s3";
import { api, getIdToken } from "./api";

/** 外部キーの選択肢。登録簿の live なクエリを購読するので、メンバーが増えれば選択肢も増える */
export const createDynamoExternalKeyResolver = () => createExternalKeyResolver(api);

/** ファイルの保存。サーバーが発行した署名付き URL に、ブラウザが S3 へ直接 PUT する */
export const createS3FileResolver = () =>
  createFileResolver(
    httpS3FileEndpoints({
      baseUrl: "/api",
      headers: async (): Promise<Record<string, string>> => {
        const token = await getIdToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  );
