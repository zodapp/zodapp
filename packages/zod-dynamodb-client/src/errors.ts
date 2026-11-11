import type { ErrorCode, ErrorIssue } from "@zodapp/zod-dynamodb";

/**
 * Clientのエラーコード。§7.5 のサーバーのコードに、Clientだけのコードを足したもの（K3）。
 *
 * - `NETWORK`：通信の失敗
 * - `UNEXPECTED_RESPONSE`：§7.5 の形でない応答（WAFやロードバランサーの応答など）
 * - `INVALID_RESPONSE`：出力の検証の失敗（コントラクトの版ずれなど）
 * - `TOO_MANY_ITEMS`：一覧の全件の取得で、件数の上限（`maxSnapshotItems`）を超えた
 */
export type ClientErrorCode =
  | ErrorCode
  | "NETWORK"
  | "UNEXPECTED_RESPONSE"
  | "INVALID_RESPONSE"
  | "TOO_MANY_ITEMS";

const DEFAULT_MESSAGES: Record<Exclude<ClientErrorCode, ErrorCode>, string> = {
  NETWORK: "サーバーと通信できませんでした",
  UNEXPECTED_RESPONSE: "サーバーから想定しない応答がありました",
  INVALID_RESPONSE: "サーバーの応答がコントラクトと一致しません",
  TOO_MANY_ITEMS: "一覧の件数が上限を超えました",
};

/** Clientが投げるエラー（K1） */
export class ClientError<
  TCode extends ClientErrorCode = ClientErrorCode,
> extends Error {
  readonly code: TCode;
  /** HTTPステータス。応答がない場合は `undefined` */
  readonly status: number | undefined;
  /** `INVALID_INPUT` のときのZodのissue */
  readonly issues: ErrorIssue[] | undefined;

  constructor(
    code: TCode,
    options: {
      message?: string;
      status?: number;
      issues?: ErrorIssue[];
      cause?: unknown;
    } = {},
  ) {
    super(
      options.message ??
        (DEFAULT_MESSAGES as Record<string, string>)[code] ??
        code,
      { cause: options.cause },
    );
    this.name = "ClientError";
    this.code = code;
    this.status = options.status;
    this.issues = options.issues;
  }
}

/** Clientのエラーか。`code` を渡すと、そのコードに型を絞り込む */
export const isClientError = <TCode extends ClientErrorCode = ClientErrorCode>(
  error: unknown,
  code?: TCode,
): error is ClientError<TCode> =>
  error instanceof ClientError && (code === undefined || error.code === code);

/** Zodのエラーなどから、`ClientError` の issue を作る */
export const issuesOf = (error: unknown): ErrorIssue[] | undefined => {
  const raw = (error as { issues?: unknown } | undefined)?.issues;
  if (!Array.isArray(raw)) return undefined;
  return raw.map(
    (i: { code?: unknown; path?: unknown; message?: unknown }) => ({
      code: String(i.code ?? "custom"),
      path: Array.isArray(i.path)
        ? i.path.map((p) => (typeof p === "number" ? p : String(p)))
        : [],
      message: String(i.message ?? ""),
    }),
  );
};
