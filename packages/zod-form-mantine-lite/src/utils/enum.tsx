import { useMemo } from "react";
import { zf, getMeta } from "@zodapp/zod-form";
import { type OptionDataType } from "./selectOption";

type EnumSchema = ReturnType<typeof zf.enum>;

/**
 * enumスキーマのオプションからSelect/MultiSelect用のdata配列を生成するフック
 */
export function useEnumData(enumSchema: EnumSchema): OptionDataType[] {
  return useMemo(() => {
    const { schemas } = getMeta(enumSchema) ?? {};
    return enumSchema.options.map((value) => {
      const literalMeta = schemas?.[value] ? getMeta(schemas[value]) : null;
      return {
        value,
        label: literalMeta?.label ?? String(value),
        color: literalMeta?.color ?? "gray",
      } satisfies OptionDataType;
    });
  }, [enumSchema]);
}
