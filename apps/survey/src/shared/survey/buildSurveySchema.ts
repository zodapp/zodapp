import { z } from "zod";
import { zf, type ComputedValue } from "@zodapp/zod-form";

import { surveyFieldSchema, type SurveyFieldDef } from "./fieldDefs";

/**
 * 保存された質問定義（DSL）から、回答フォーム用の zf スキーマを実行時に組み立てる。
 *
 * 設計方針:
 * - **1 件の壊れた質問で全体を落とさない**。パースできなかった質問はその位置だけ
 *   エラー表示用のセンチネル（`zf.computed` のバッジ）に差し替え、残りは描画を続ける
 * - 戻り値を `{ schema, warnings, fieldErrors }` の 3 つに分け、
 *   「描画はできるが注意が必要」と「描画できない」を呼び出し側が区別できるようにする
 * - React 非依存の純関数（単体テスト可能）
 */

export type SurveyFieldError = {
  /** 質問 ID（不明な場合は `#index`） */
  id: string;
  message: string;
};

export type BuildSurveySchemaResult = {
  /** 回答（answers）用スキーマ。キーは質問 ID */
  schema: z.ZodObject<z.ZodRawShape>;
  /** 描画は継続できるが利用者に伝えるべき事項 */
  warnings: string[];
  /** 復元できずセンチネルに置き換えた質問 */
  fieldErrors: SurveyFieldError[];
};

/** 復元できなかった質問の位置に差し込む表示専用フィールド */
const createSentinelSchema = (message: string) =>
  zf
    .computed()
    .register(zf.computed.registry, {
      label: "表示できない質問",
      compute: (): ComputedValue => ({
        type: "badge",
        label: message,
        color: "red",
      }),
    })
    .optional();

const buildFieldSchema = (
  field: SurveyFieldDef,
  warnings: string[],
): z.ZodTypeAny => {
  const required = field.required === true;
  const label = field.label;

  switch (field.type) {
    case "text": {
      let base = zf.string();
      if (required) base = base.min(1, "入力してください");
      if (field.maxLength !== undefined) {
        base = base.max(
          field.maxLength,
          `${field.maxLength}文字以内で入力してください`,
        );
      }
      const registered = base.register(zf.string.registry, { label });
      return required ? registered : registered.optional();
    }

    case "multiline": {
      let base = zf.string();
      if (required) base = base.min(1, "入力してください");
      const registered = base.register(zf.string.registry, {
        label,
        uiType: "multiline",
      });
      return required ? registered : registered.optional();
    }

    case "number": {
      let base = zf.number();
      if (field.min !== undefined) {
        base = base.min(field.min, `${field.min} 以上で入力してください`);
      }
      if (field.max !== undefined) {
        base = base.max(field.max, `${field.max} 以下で入力してください`);
      }
      const registered = base.register(zf.number.registry, { label });
      return required ? registered : registered.optional();
    }

    case "select": {
      const options = field.options ?? [];
      if (options.length === 0) {
        warnings.push(`「${label}」に選択肢がないため入力欄になりました`);
        const fallback = zf.string().register(zf.string.registry, { label });
        return required ? fallback : fallback.optional();
      }
      const literals = options.map((option) =>
        z
          .literal(option.value)
          .register(zf.literal.registry, { label: option.label }),
      ) as unknown as readonly [
        z.ZodLiteral<string>,
        ...z.ZodLiteral<string>[],
      ];
      const registered = zf
        .enum(literals)
        .register(zf.enum.registry, { label });
      return required ? registered : registered.optional();
    }

    case "boolean": {
      if (required) {
        // 必須のチェックは「チェックされていること」を要求する（同意チェックの型）
        return zf
          .literal(true, "チェックしてください")
          .register(zf.boolean.registry, { label });
      }
      return zf
        .boolean()
        .register(zf.boolean.registry, { label })
        .optional();
    }

    case "date": {
      const registered = zf.date().register(zf.date.registry, { label });
      return required ? registered : registered.optional();
    }
  }
};

const toObjectSchema = (shape: Record<string, z.ZodTypeAny>) =>
  z.object(shape).register(zf.object.registry, {}) as z.ZodObject<z.ZodRawShape>;

export const buildSurveySchema = (
  fields: unknown,
): BuildSurveySchemaResult => {
  const warnings: string[] = [];
  const fieldErrors: SurveyFieldError[] = [];
  const shape: Record<string, z.ZodTypeAny> = {};

  if (fields === undefined || fields === null) {
    return { schema: toObjectSchema(shape), warnings, fieldErrors };
  }

  if (!Array.isArray(fields)) {
    warnings.push("質問定義が配列ではないため、質問を表示できません");
    return { schema: toObjectSchema(shape), warnings, fieldErrors };
  }

  const seenIds = new Set<string>();

  fields.forEach((rawField, index) => {
    const parsed = surveyFieldSchema.safeParse(rawField);

    if (!parsed.success) {
      const fallbackId =
        typeof (rawField as { id?: unknown })?.id === "string"
          ? ((rawField as { id: string }).id)
          : `#${index + 1}`;
      const message =
        parsed.error.issues[0]?.message ?? "質問定義を読み込めませんでした";
      fieldErrors.push({ id: fallbackId, message });
      shape[`__invalid_${index}`] = createSentinelSchema(
        `${index + 1} 番目の質問: ${message}`,
      );
      return;
    }

    const field = parsed.data;

    if (seenIds.has(field.id)) {
      warnings.push(
        `質問 ID「${field.id}」が重複しているため、${index + 1} 番目の質問を表示しません`,
      );
      return;
    }
    seenIds.add(field.id);

    shape[field.id] = buildFieldSchema(field, warnings);
  });

  return { schema: toObjectSchema(shape), warnings, fieldErrors };
};
