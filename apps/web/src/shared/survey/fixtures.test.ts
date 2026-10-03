import { describe, expect, it } from "vitest";

import { surveyFixtures } from "./fixtures";
import { surveyFieldsSchema } from "./fieldDefs";
import { buildSurveySchema } from "./buildSurveySchema";
import { generateDummyAnswers } from "./generateDummyAnswers";

/**
 * フィクスチャは CI のルールテストとアプリのテストデータ画面の両方から使う。
 * DSL が変わったときにフィクスチャだけ古いまま残らないよう、
 * 実際のスキーマで検証する。
 */
describe("survey fixtures", () => {
  it("すべてのフィクスチャの質問定義が DSL スキーマを満たす", () => {
    for (const fixture of surveyFixtures) {
      const parsed = surveyFieldsSchema.safeParse(fixture.fields);
      expect(parsed.success, `${fixture.surveyId} の質問定義が不正`).toBe(true);
    }
  });

  it("質問定義から実行時スキーマを組み立てられる（エラー・警告なし）", () => {
    for (const fixture of surveyFixtures) {
      const { schema, warnings, fieldErrors } = buildSurveySchema(
        fixture.fields,
      );
      expect(fieldErrors, `${fixture.surveyId}`).toEqual([]);
      expect(warnings, `${fixture.surveyId}`).toEqual([]);
      expect(Object.keys(schema.shape)).toHaveLength(fixture.fields.length);
    }
  });

  it("ドキュメント ID と質問 ID が固定されている（再投入で冪等）", () => {
    const surveyIds = surveyFixtures.map((fixture) => fixture.surveyId);
    expect(new Set(surveyIds).size).toBe(surveyIds.length);

    for (const fixture of surveyFixtures) {
      for (const field of fixture.fields) {
        // 自動採番（f + 8 桁）ではなく、意味のある固定 ID であること
        expect(field.id).toMatch(/^q_/);
      }
    }
  });

  it("公開中・下書き・削除済みが揃っている", () => {
    const statuses = surveyFixtures.map((fixture) => fixture.data.status);
    expect(statuses).toContain("published");
    expect(statuses).toContain("draft");
    expect(
      surveyFixtures.some((fixture) => fixture.data.deletedAt != null),
    ).toBe(true);
  });

  it("生成したダミー回答が実行時スキーマを通る", () => {
    for (const fixture of surveyFixtures) {
      const { schema } = buildSurveySchema(fixture.fields);
      for (let index = 0; index < 10; index += 1) {
        const { answers, isValid } = generateDummyAnswers(
          fixture.fields,
          index,
        );
        expect(isValid, `${fixture.surveyId} #${index}`).toBe(true);
        expect(schema.safeParse(answers).success).toBe(true);
      }
    }
  });
});
