/**
 * ファイルのエンドポイントと S3 への PUT のエラーのコード。
 *
 * - `UNAUTHENTICATED`・`FORBIDDEN`・`INVALID_INPUT`：サーバー（`@zodapp/zod-form-s3-node`）が返すコード
 * - `NETWORK`：通信の失敗
 * - `UNEXPECTED_RESPONSE`：`{ code, message }` の形でない応答（WAF やロードバランサーの応答など）
 * - `UPLOAD_FAILED`：署名付き URL への PUT の失敗
 *
 * アプリのエラーハンドラーが返すほかのコード（`INTERNAL` など）も、そのまま入る。
 */
export type S3FileErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NETWORK"
  | "UNEXPECTED_RESPONSE"
  | "UPLOAD_FAILED"
  | (string & {});

/** ファイルのエンドポイントと S3 への PUT が投げるエラー */
export class S3FileError extends Error {
  readonly code: S3FileErrorCode;
  /** HTTP ステータス。応答がない場合は `undefined` */
  readonly status: number | undefined;

  constructor(
    code: S3FileErrorCode,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "S3FileError";
    this.code = code;
    this.status = options.status;
  }
}

/** ファイルのエラーか。`code` を渡すと、そのコードかも確かめる */
export const isS3FileError = (
  error: unknown,
  code?: S3FileErrorCode,
): error is S3FileError =>
  error instanceof S3FileError && (code === undefined || error.code === code);
