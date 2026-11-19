import { describe, expect, it } from "vitest";
import {
  ASYNC_VALIDATION_ISSUE_CODE,
  PENDING_ISSUE_CODE,
  RESOLVE_ERROR_ISSUE_CODE,
} from "@zodapp/zod-form-react";
import { submitBlockedReasons } from "./submitBlocked";

// 返すのは辞書のキー
const LOADING = "zodFormWidget.autoForm.blocked.loading";
const FAILED = "zodFormWidget.autoForm.blocked.failed";
const INPUT = "zodFormWidget.autoForm.blocked.input";

describe("submitBlockedReasons", () => {
  it("読み込み中の欄だけなら、読み込み中を理由にする", () => {
    expect(submitBlockedReasons([{ code: PENDING_ISSUE_CODE }])).toEqual([
      LOADING,
    ]);
  });

  it("取得できなかった欄だけなら、取得の失敗を理由にする", () => {
    expect(submitBlockedReasons([{ code: RESOLVE_ERROR_ISSUE_CODE }])).toEqual([
      FAILED,
    ]);
  });

  it("非同期の検証の印だけなら、非同期の検証を理由にする", () => {
    expect(
      submitBlockedReasons([{ code: ASYNC_VALIDATION_ISSUE_CODE }]),
    ).toEqual([
      "zodFormWidget.autoForm.blocked.async" /* i18n: このフォームでは非同期の検証を扱えないため、送信できませんでした */,
    ]);
  });

  it("入力の誤りだけなら、入力の誤りを理由にする", () => {
    expect(submitBlockedReasons([{ code: "invalid_type" }])).toEqual([INPUT]);
  });

  it("当てはまるものをすべて返す", () => {
    expect(
      submitBlockedReasons([
        { code: "too_small" },
        { code: RESOLVE_ERROR_ISSUE_CODE },
        { code: PENDING_ISSUE_CODE },
      ]),
    ).toEqual([LOADING, FAILED, INPUT]);
  });

  it("issue が無いのに止まったときは、入力の誤りとする", () => {
    expect(submitBlockedReasons([])).toEqual([INPUT]);
  });
});
