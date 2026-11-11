import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type S3FileSignerOptions = {
  client: S3Client;
  bucket: string;
  /** 署名付き URL の有効期間（秒）。既定は 300 */
  expiresIn?: number;
};

export type S3FileSigner = {
  readonly bucket: string;
  /** アップロード（PUT）の署名付き URL。`contentType` は PUT の content-type と一致させる */
  signUpload(key: string, contentType: string): Promise<string>;
  /** ダウンロード（GET）の署名付き URL */
  signDownload(key: string): Promise<string>;
  /** オブジェクトを消す */
  deleteObject(key: string): Promise<void>;
  /** バケットがなければ作る（ローカルの S3 互換のストレージ向け） */
  ensureBucket(): Promise<"exists" | "created">;
};

/**
 * 署名付き URL を発行する。
 *
 * ブラウザの PUT では checksum を計算しないので、S3Client は
 * `requestChecksumCalculation: "WHEN_REQUIRED"` で作る。
 * S3 互換のストレージ（S3Proxy など）では `endpoint` と `forcePathStyle: true` も指定する。
 */
export const createS3FileSigner = (options: S3FileSignerOptions): S3FileSigner => {
  const { client, bucket } = options;
  const expiresIn = options.expiresIn ?? 300;
  return {
    bucket,
    signUpload: (key, contentType) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn },
      ),
    signDownload: (key) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn,
      }),
    deleteObject: async (key) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    ensureBucket: async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return "exists";
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        return "created";
      }
    },
  };
};
