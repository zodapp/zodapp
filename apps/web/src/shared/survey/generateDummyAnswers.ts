import type { SurveyFieldDef } from "./fieldDefs";
import { buildSurveySchema } from "./buildSurveySchema";

/**
 * 質問定義（DSL）からダミー回答を生成する。
 *
 * 生成した値は、回答フォームが使うのと**同じ実行時スキーマ**
 * （`buildSurveySchema`）で検証してから返す。
 * これにより「スキーマ駆動で作ったダミーデータが、そのスキーマで
 * 通ること」が保証される。
 */

const SAMPLE_NAMES = [
  "山田 太郎",
  "佐藤 花子",
  "鈴木 一郎",
  "田中 美咲",
  "高橋 健",
  "伊藤 彩",
];

const SAMPLE_COMMENTS = [
  "とても使いやすいです。",
  "画面の表示が速くなると嬉しいです。",
  "サポートの対応が丁寧でした。",
  "検索機能をもう少し充実してほしいです。",
  "料金プランがわかりやすくなりました。",
  "",
];

const pick = <T,>(items: readonly T[], index: number): T =>
  items[index % items.length]!;

const buildValue = (field: SurveyFieldDef, index: number): unknown => {
  switch (field.type) {
    case "text": {
      const value = pick(SAMPLE_NAMES, index);
      return field.maxLength !== undefined
        ? value.slice(0, field.maxLength)
        : value;
    }
    case "multiline":
      return pick(SAMPLE_COMMENTS, index) || (field.required ? "ご意見です。" : undefined);
    case "number": {
      const min = field.min ?? 0;
      const max = field.max ?? min + 20;
      return min + (index % Math.max(1, max - min + 1));
    }
    case "select": {
      const option = pick(field.options, index);
      return option?.value;
    }
    case "boolean":
      // 必須のチェック（同意など）は常に true でないとスキーマを通らない
      return field.required ? true : index % 3 !== 0;
    case "date": {
      const daysAgo = index % 30;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);
      return date;
    }
  }
};

export type DummyAnswerResult = {
  answers: Record<string, unknown>;
  /** 生成した値が実行時スキーマを通ったか */
  isValid: boolean;
};

export const generateDummyAnswers = (
  fields: unknown,
  index: number,
): DummyAnswerResult => {
  const { schema } = buildSurveySchema(fields);
  const fieldList = Array.isArray(fields) ? (fields as SurveyFieldDef[]) : [];

  const answers: Record<string, unknown> = {};
  for (const field of fieldList) {
    if (!field || typeof field !== "object" || !("type" in field)) continue;
    const value = buildValue(field, index);
    // Firestore は undefined を保存できないため未回答は入れない
    if (value !== undefined) answers[field.id] = value;
  }

  return { answers, isValid: schema.safeParse(answers).success };
};
