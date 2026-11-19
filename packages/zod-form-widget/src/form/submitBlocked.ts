import {
  ASYNC_VALIDATION_ISSUE_CODE,
  PENDING_ISSUE_CODE,
  RESOLVE_ERROR_ISSUE_CODE,
} from "@zodapp/zod-form-react";
import { msgKey } from "@zodapp/i18n-messages";
import "../messages/types";

/**
 * 送信が止まった理由を、runtime.validate の issue から数える。当てはまるものをすべて返す。
 *
 * - 読み込み中の欄がある（取り直し中の印の issue）
 * - 取得できなかった欄がある（取得の失敗の印の issue）
 * - 非同期の検証が要る（z.promise()・async の refine。非同期の検証の印の issue）
 * - 入力の誤りがある（それ以外の issue）
 *
 * issue が無いのに止まったとき（欄の検証だけが誤りのときなど）は、入力の誤りとする。
 * 返すのは辞書のキー（`msg.resolve` で文言にする）
 */
export const submitBlockedReasons = (
  issues: readonly { code?: string }[],
): string[] => {
  const reasons: string[] = [];
  if (issues.some((issue) => issue.code === PENDING_ISSUE_CODE)) {
    reasons.push(
      msgKey(
        "zodFormWidget.autoForm.blocked.loading" /* i18n: 読み込み中の欄があるため、送信できませんでした */,
      ),
    );
  }
  if (issues.some((issue) => issue.code === RESOLVE_ERROR_ISSUE_CODE)) {
    reasons.push(
      msgKey(
        "zodFormWidget.autoForm.blocked.failed" /* i18n: 取得できなかった欄があるため、送信できませんでした */,
      ),
    );
  }
  if (issues.some((issue) => issue.code === ASYNC_VALIDATION_ISSUE_CODE)) {
    reasons.push(
      msgKey(
        "zodFormWidget.autoForm.blocked.async" /* i18n: このフォームでは非同期の検証を扱えないため、送信できませんでした */,
      ),
    );
  }
  const hasInputError = issues.some(
    (issue) =>
      issue.code !== PENDING_ISSUE_CODE &&
      issue.code !== RESOLVE_ERROR_ISSUE_CODE &&
      issue.code !== ASYNC_VALIDATION_ISSUE_CODE,
  );
  if (hasInputError || reasons.length === 0) {
    reasons.push(
      msgKey(
        "zodFormWidget.autoForm.blocked.input" /* i18n: 入力に誤りがあるため、送信できませんでした */,
      ),
    );
  }
  return reasons;
};
