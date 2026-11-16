import {
  PENDING_ISSUE_CODE,
  RESOLVE_ERROR_ISSUE_CODE,
} from "@zodapp/zod-form-react";

/**
 * 送信が止まった理由を、runtime.validate の issue から数える。当てはまるものをすべて返す。
 *
 * - 読み込み中の欄がある（取り直し中の印の issue）
 * - 取得できなかった欄がある（取得の失敗の印の issue）
 * - 入力の誤りがある（それ以外の issue）
 *
 * issue が無いのに止まったとき（欄の検証だけが誤りのときなど）は、入力の誤りとする
 */
export const submitBlockedReasons = (
  issues: readonly { code?: string }[],
): string[] => {
  const reasons: string[] = [];
  if (issues.some((issue) => issue.code === PENDING_ISSUE_CODE)) {
    reasons.push("読み込み中の欄があるため、送信できませんでした");
  }
  if (issues.some((issue) => issue.code === RESOLVE_ERROR_ISSUE_CODE)) {
    reasons.push("取得できなかった欄があるため、送信できませんでした");
  }
  const hasInputError = issues.some(
    (issue) =>
      issue.code !== PENDING_ISSUE_CODE &&
      issue.code !== RESOLVE_ERROR_ISSUE_CODE,
  );
  if (hasInputError || reasons.length === 0) {
    reasons.push("入力に誤りがあるため、送信できませんでした");
  }
  return reasons;
};
