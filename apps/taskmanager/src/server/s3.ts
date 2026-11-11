import { S3Client } from "@aws-sdk/client-s3";
import { createS3FileSigner } from "@zodapp/zod-form-s3-node";
import { config } from "./env";

export const createS3Client = () =>
  new S3Client({
    region: config.dynamodb.region,
    ...(config.s3.endpoint
      ? {
          endpoint: config.s3.endpoint,
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey,
          },
        }
      : {}),
    // 署名付き URL に checksum のパラメーターを入れない（ブラウザの PUT では計算しないため）
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

/** 署名付き URL の発行（@zodapp/zod-form-s3-node） */
export const createFileSigner = (client: S3Client) =>
  createS3FileSigner({ client, bucket: config.s3.bucket, expiresIn: 300 });

/** 保存先のキーが `workspaces/{id}/` で始まるなら、その ID */
export const workspaceOfKey = (key: string) =>
  /^workspaces\/([^/]+)\/./.exec(key)?.[1];
