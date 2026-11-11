import { z } from "zod";
import type { SurveyFieldDef } from "./fieldDefs";

/**
 * 回答の値。質問の種類ごとに型が異なる（text / multiline / select は文字列、
 * number は数値、boolean は真偽値、date は Date）。
 *
 * DynamoDB とブラウザの間の変換（zod-dynamodb の保存の変換と、zod-transport-json）は
 * Schema に沿って行うので、`z.unknown()` では Date を戻せない。
 * 日付は `YYYY-MM-DD` の文字列で保存し、フォームに戻すときに Date にする。
 */
export const answerValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export type AnswerValue = z.infer<typeof answerValueSchema>;
export type StoredAnswers = Record<string, AnswerValue>;

const pad = (n: number) => String(n).padStart(2, "0");

/** ローカルの日付を `YYYY-MM-DD` にする */
export const toDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `YYYY-MM-DD` をローカルの 0 時の Date にする */
export const fromDateString = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

const fieldsOf = (fields: unknown): SurveyFieldDef[] =>
  Array.isArray(fields) ? (fields as SurveyFieldDef[]) : [];

/** 回答フォームの値（Date を含む）を、保存する形にする。未回答（undefined / null）は入れない */
export const toStoredAnswers = (
  fields: unknown,
  values: Record<string, unknown>,
): StoredAnswers => {
  const out: StoredAnswers = {};
  const dateIds = new Set(
    fieldsOf(fields)
      .filter((f) => f?.type === "date")
      .map((f) => f.id),
  );
  for (const [id, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Date) out[id] = toDateString(value);
    else if (dateIds.has(id) && typeof value === "string") out[id] = value;
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[id] = value;
    }
  }
  return out;
};

/** 保存した回答を、回答フォームの値（日付の質問は Date）に戻す */
export const fromStoredAnswers = (
  fields: unknown,
  answers: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...(answers ?? {}) };
  for (const field of fieldsOf(fields)) {
    const value = out[field?.id];
    if (field?.type === "date" && typeof value === "string") {
      out[field.id] = fromDateString(value);
    }
  }
  return out;
};
