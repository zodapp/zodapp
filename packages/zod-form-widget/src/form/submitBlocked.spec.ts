import { describe, expect, it } from "vitest";
import {
  PENDING_ISSUE_CODE,
  RESOLVE_ERROR_ISSUE_CODE,
} from "@zodapp/zod-form-react";
import { submitBlockedReasons } from "./submitBlocked";

const LOADING = "読み込み中の欄があるため、送信できませんでした";
const FAILED = "取得できなかった欄があるため、送信できませんでした";
const INPUT = "入力に誤りがあるため、送信できませんでした";

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
