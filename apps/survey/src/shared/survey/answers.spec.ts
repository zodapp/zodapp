import { describe, expect, it } from "vitest";
import { fromStoredAnswers, toStoredAnswers } from "./answers";
import type { SurveyFieldDef } from "./fieldDefs";

const fields: SurveyFieldDef[] = [
  { type: "text", id: "q_name", label: "名前" },
  { type: "date", id: "q_date", label: "日付" },
  { type: "number", id: "q_n", label: "数" },
  { type: "boolean", id: "q_ok", label: "同意" },
];

describe("answers", () => {
  it("日付を YYYY-MM-DD にして保存し、Date に戻す。未回答は落とす", () => {
    const stored = toStoredAnswers(fields, {
      q_name: "太郎",
      q_date: new Date(2026, 3, 5),
      q_n: 3,
      q_ok: false,
      q_missing: undefined,
    });
    expect(stored).toEqual({ q_name: "太郎", q_date: "2026-04-05", q_n: 3, q_ok: false });

    const values = fromStoredAnswers(fields, stored);
    expect(values.q_date).toEqual(new Date(2026, 3, 5));
    expect(values.q_name).toBe("太郎");
  });

  it("定義にない回答はそのまま返す", () => {
    expect(fromStoredAnswers(fields, { old: "x" })).toEqual({ old: "x" });
  });
});
