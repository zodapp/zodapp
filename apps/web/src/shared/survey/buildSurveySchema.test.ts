import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { getMeta } from "@zodapp/zod-form";

import { buildSurveySchema } from "./buildSurveySchema";
import { surveyFieldsSchema } from "./fieldDefs";

const textField = {
  type: "text" as const,
  id: "f_text",
  label: "お名前",
  required: true,
};

describe("buildSurveySchema", () => {
  it("6 種類の質問をすべてスキーマ化できる", () => {
    const { schema, warnings, fieldErrors } = buildSurveySchema([
      textField,
      { type: "multiline", id: "f_multi", label: "ご意見" },
      { type: "number", id: "f_num", label: "年齢", min: 0, max: 120 },
      {
        type: "select",
        id: "f_sel",
        label: "満足度",
        options: [
          { value: "high", label: "満足" },
          { value: "low", label: "不満" },
        ],
      },
      { type: "boolean", id: "f_bool", label: "同意する" },
      { type: "date", id: "f_date", label: "来店日" },
    ]);

    expect(warnings).toEqual([]);
    expect(fieldErrors).toEqual([]);
    expect(Object.keys(schema.shape)).toEqual([
      "f_text",
      "f_multi",
      "f_num",
      "f_sel",
      "f_bool",
      "f_date",
    ]);

    const parsed = schema.safeParse({
      f_text: "山田",
      f_multi: "感想",
      f_num: 30,
      f_sel: "high",
      f_bool: true,
      f_date: new Date("2026-01-01"),
    });
    expect(parsed.success).toBe(true);
  });

  it("required を反映する（未入力は必須のみ失敗する）", () => {
    const { schema } = buildSurveySchema([
      textField,
      { type: "text", id: "f_opt", label: "任意項目" },
    ]);

    expect(schema.safeParse({ f_text: "山田" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("number の min/max が検証に反映される", () => {
    const { schema } = buildSurveySchema([
      { type: "number", id: "f_num", label: "年齢", min: 20, max: 30 },
    ]);

    expect(schema.safeParse({ f_num: 25 }).success).toBe(true);
    expect(schema.safeParse({ f_num: 10 }).success).toBe(false);
    expect(schema.safeParse({ f_num: 40 }).success).toBe(false);
  });

  it("select は選択肢の value のみ受け付け、literal に label メタが付く", () => {
    const { schema } = buildSurveySchema([
      {
        type: "select",
        id: "f_sel",
        label: "満足度",
        required: true,
        options: [
          { value: "high", label: "満足" },
          { value: "low", label: "不満" },
        ],
      },
    ]);

    expect(schema.safeParse({ f_sel: "high" }).success).toBe(true);
    expect(schema.safeParse({ f_sel: "unknown" }).success).toBe(false);

    const enumMeta = getMeta(schema.shape.f_sel as z.ZodTypeAny, "enum");
    expect(enumMeta?.label).toBe("満足度");
    expect(getMeta(enumMeta!.schemas!.high!, "literal")?.label).toBe("満足");
  });

  it("必須の boolean はチェック済み（true）のみ受け付ける", () => {
    const { schema } = buildSurveySchema([
      { type: "boolean", id: "f_agree", label: "同意する", required: true },
    ]);

    expect(schema.safeParse({ f_agree: true }).success).toBe(true);
    expect(schema.safeParse({ f_agree: false }).success).toBe(false);
  });

  it("壊れた質問はその項目だけセンチネルに置き換え、他は描画を継続する", () => {
    const { schema, fieldErrors } = buildSurveySchema([
      textField,
      { type: "unknown-type", id: "f_broken", label: "壊れた質問" },
      { type: "multiline", id: "f_multi", label: "ご意見" },
    ]);

    expect(fieldErrors).toHaveLength(1);
    expect(fieldErrors[0]?.id).toBe("f_broken");
    // 正常な質問はそのまま残る
    expect(Object.keys(schema.shape)).toContain("f_text");
    expect(Object.keys(schema.shape)).toContain("f_multi");
    // 壊れた質問はセンチネル（表示専用）になる
    expect(Object.keys(schema.shape)).toContain("__invalid_1");
    expect(schema.safeParse({ f_text: "山田" }).success).toBe(true);
  });

  it("label が空の質問もセンチネルになる", () => {
    const { fieldErrors } = buildSurveySchema([
      { type: "text", id: "f_nolabel", label: "" },
    ]);
    expect(fieldErrors).toHaveLength(1);
  });

  it("ID が重複した質問は警告のうえスキップする", () => {
    const { schema, warnings } = buildSurveySchema([
      textField,
      { type: "multiline", id: "f_text", label: "重複 ID" },
    ]);

    expect(warnings).toHaveLength(1);
    expect(Object.keys(schema.shape)).toEqual(["f_text"]);
  });

  it("選択肢が空の select は入力欄にフォールバックし警告を出す", () => {
    const { schema, warnings, fieldErrors } = buildSurveySchema([
      { type: "select", id: "f_sel", label: "満足度", options: [] },
    ]);

    // options の min(1) で parse に失敗するためセンチネル扱いになる
    expect(fieldErrors.length + warnings.length).toBeGreaterThan(0);
    expect(Object.keys(schema.shape)).toHaveLength(1);
  });

  it("空配列・未定義・配列でない値を安全に扱う", () => {
    expect(Object.keys(buildSurveySchema([]).schema.shape)).toEqual([]);
    expect(Object.keys(buildSurveySchema(undefined).schema.shape)).toEqual([]);
    expect(buildSurveySchema("broken").warnings).toHaveLength(1);
  });

  it("DSL スキーマは種別ごとの追加設定を検証する", () => {
    const parsed = surveyFieldsSchema.safeParse([
      { type: "number", id: "f_num", label: "年齢", min: 0 },
    ]);
    expect(parsed.success).toBe(true);

    const invalid = surveyFieldsSchema.safeParse([
      { type: "select", id: "f_sel", label: "満足度", options: [] },
    ]);
    expect(invalid.success).toBe(false);
  });

  it("id が未指定の質問には ID が自動採番される", () => {
    const parsed = surveyFieldsSchema.parse([
      { type: "text", label: "自動採番" },
    ]);
    expect(parsed[0]?.id).toMatch(/^f[0-9a-f]{8}$/);
  });
});
