import { z } from "zod";

/** 通信のエラーコード（§7.5） */
export const ERROR_CODES = [
  "INVALID_INPUT",
  "INVALID_CURSOR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "CONFLICT",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  INVALID_INPUT: 400,
  INVALID_CURSOR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  CONFLICT: 409,
  INTERNAL: 500,
};

/** 既定のメッセージ。Itemの有無が漏れないように、エラーの詳細は返さない */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  INVALID_INPUT: "入力が正しくありません",
  INVALID_CURSOR: "ページネーションのトークンが正しくありません",
  UNAUTHENTICATED: "認証が必要です（認証の情報がないか、期限が切れています）",
  FORBIDDEN: "この操作は許可されていません",
  NOT_FOUND: "Itemが存在しないか、条件を満たしていない",
  ALREADY_EXISTS: "Itemはすでに存在します",
  CONFLICT: "Itemは他の更新と競合しました",
  INTERNAL: "内部エラーが発生しました",
};

const issueSchema = z.object({
  code: z.string(),
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

/** エラーのbody（§7.5） */
export const errorBodySchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  issues: z.array(issueSchema).optional(),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ErrorIssue = z.infer<typeof issueSchema>;

/** エラーの名前（`error.name`）から求めるエラーコード */
const CODE_BY_NAME: Readonly<Record<string, ErrorCode>> = {
  ZodError: "INVALID_INPUT",
  ValidationError: "INVALID_INPUT",
  InvalidTokenError: "INVALID_INPUT",
  InvalidCursorError: "INVALID_CURSOR",
  ItemNotFoundError: "NOT_FOUND",
  ConditionFailedError: "NOT_FOUND",
  ItemAlreadyExistsError: "ALREADY_EXISTS",
  ConflictError: "CONFLICT",
  ForbiddenError: "FORBIDDEN",
  UnauthenticatedError: "UNAUTHENTICATED",
  StaleItemError: "CONFLICT",
};

/**
 * Repositoryなどのエラーからエラーコードを求める（§7.5）。
 * エラーのクラスは `zod-dynamodb-node` にあるので、クラスの名前で判定する。
 * 該当しないエラーは `INTERNAL`。
 */
export const toErrorCode = (error: unknown): ErrorCode => {
  const name = error instanceof Error ? error.name : undefined;
  return (name && CODE_BY_NAME[name]) || "INTERNAL";
};

/** エラーからbodyを作る。`INVALID_INPUT` ではZodのissueを入れる */
export const toErrorBody = (error: unknown): ErrorBody => {
  const code = toErrorCode(error);
  const issues = issuesOf(error);
  return {
    code,
    message: ERROR_MESSAGES[code],
    ...(code === "INVALID_INPUT" && issues ? { issues } : {}),
  };
};

const issuesOf = (error: unknown): ErrorIssue[] | undefined => {
  const raw =
    (error as { issues?: unknown }).issues ??
    ((error as { cause?: { issues?: unknown } }).cause?.issues as unknown);
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
