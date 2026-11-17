import { useMemo } from "react";
import type { z } from "zod";
import { getMeta } from "@zodapp/zod-form";
import { type OptionDataType } from "./selectOption";

// 文字列の enum も数値の enum も受け付ける
type EnumSchema = z.ZodEnum<z.core.util.EnumLike>;
type EnumValue = string | number;

/**
 * enumスキーマのオプションからSelect/MultiSelect用のdata配列を生成するフック。
 * Select の値は文字列なので、数値の選択肢も文字列にして渡す ({@link fromEnumOptionValue} で戻す)
 */
export function useEnumData(enumSchema: EnumSchema): OptionDataType[] {
  return useMemo(() => {
    const { schemas } = getMeta(enumSchema) ?? {};
    return (enumSchema.options as readonly EnumValue[]).map((value) => {
      const key = String(value);
      const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
      return {
        value: key,
        label: literalMeta?.label ?? key,
        color: literalMeta?.color ?? "gray",
      } satisfies OptionDataType;
    });
  }, [enumSchema]);
}

/** フォームの値を Select の値 (文字列) にする。未選択 (undefined / null / 空文字) は null */
export const toEnumOptionValue = (value: unknown): string | null =>
  value === undefined || value === null || value === "" ? null : String(value);

/** Select の値 (文字列) を enum の値 (文字列または数値) に戻す。未選択は undefined */
export const fromEnumOptionValue = (
  enumSchema: EnumSchema,
  optionValue: string | null | undefined,
): EnumValue | undefined => {
  if (optionValue === null || optionValue === undefined || optionValue === "")
    return undefined;
  return (
    (enumSchema.options as readonly EnumValue[]).find(
      (value) => String(value) === optionValue,
    ) ?? optionValue
  );
};

/**
 * 選択の欄の選択肢と、フォームの値・Select の値（文字列）の行き来。
 * enum と、literal だけの union（`uiType: "select"` など）で同じ部品を使うためにまとめる。
 */
export type Choices = {
  /** Select / MultiSelect に渡す選択肢 */
  data: OptionDataType[];
  /**
   * フォームの値を Select の値にする。未選択（undefined・null・空文字）は null。
   * 選択肢に無い値は、選択肢のどれとも重ならない文字列にする（data に無いことで見分ける）
   */
  toOption: (value: unknown) => string | null;
  /** Select の値をフォームの値に戻す。未選択や、選択肢に無い Select の値は undefined */
  fromOption: (option: string | null | undefined) => unknown;
};

const isEmptyOption = (option: string | null | undefined) =>
  option === null || option === undefined || option === "";

const enumChoices = (enumSchema: EnumSchema): Choices => {
  const { schemas } = getMeta(enumSchema) ?? {};
  return {
    data: (enumSchema.options as readonly EnumValue[]).map((value) => {
      const key = String(value);
      const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
      return {
        value: key,
        label: literalMeta?.label ?? key,
        color: literalMeta?.color ?? "gray",
      } satisfies OptionDataType;
    }),
    toOption: toEnumOptionValue,
    fromOption: (option) => fromEnumOptionValue(enumSchema, option),
  };
};

/** 選択肢に無い値の Select の値（腕の番号と重ならないよう、数字だけにしない） */
const UNLISTED_OPTION_PREFIX = "unlisted:";

/**
 * literal だけの union の選択肢。Select とは腕の番号（"0"・"1"…）でやりとりする。
 * 番号は Select の中だけで使い、フォームの値には literal の値をそのまま書く。
 * そのため `literal(10)` と `literal("10")` も区別でき、bigint・null の literal も扱える。
 * literal でない腕は選べないので、選択肢に出さない（警告を出す）
 */
const literalUnionChoices = (unionSchema: z.ZodUnion): Choices => {
  const arms = (unionSchema.def.options as z.ZodTypeAny[]).flatMap(
    (arm, index) => {
      const values = (arm.def as { values?: unknown[] }).values;
      if (arm.type !== "literal" || !values || values.length !== 1) {
        console.warn(
          `literal の union の選択肢：${index + 1} 番目の腕は literal ではないので、選択肢に出しません（type: ${arm.type}）`,
        );
        return [];
      }
      return [{ index, value: values[0], meta: getMeta(arm) }];
    },
  );
  return {
    data: arms.map(({ index, value, meta }) => ({
      value: String(index),
      label: meta?.label ?? String(value),
      color: meta?.color ?? "gray",
    })),
    toOption: (value) => {
      const arm = arms.find((candidate) => candidate.value === value);
      if (arm) return String(arm.index);
      if (value === undefined || value === null || value === "") return null;
      return `${UNLISTED_OPTION_PREFIX}${String(value)}`;
    },
    fromOption: (option) => {
      if (isEmptyOption(option)) return undefined;
      return arms.find((arm) => String(arm.index) === option)?.value;
    },
  };
};

/** enum か literal だけの union の選択肢（{@link Choices}） */
export const choicesOf = (schema: z.ZodTypeAny): Choices =>
  schema.type === "union"
    ? literalUnionChoices(schema as z.ZodUnion)
    : enumChoices(schema as EnumSchema);

/** {@link choicesOf} を schema ごとに一度だけ作る hook */
export function useChoices(schema: z.ZodTypeAny): Choices {
  return useMemo(() => choicesOf(schema), [schema]);
}
