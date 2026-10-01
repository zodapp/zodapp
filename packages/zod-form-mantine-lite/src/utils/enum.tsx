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
