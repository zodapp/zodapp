import { PreprocessorDef, preprocess } from "@zodapp/zod-transform";
import z from "zod";
import { $ZodCheckLengthEqualsDef, $ZodCheckMinLengthDef } from "zod/v4/core";
import { extractCheck } from "./zod";

/**
 * Zod スキーマから「フォーム初期化向け」のデフォルト値を生成します。
 *
 * `z.default(...)` の defaultValue だけでなく、object/array/set/map なども「空の値」を補完します。
 */
export const getDefaultValue = (schema: z.ZodTypeAny) => {
  return preprocess(
    undefined,
    schema,
    {
      object: (obj, schema) => {
        const _schema = schema as z.ZodObject<z.ZodRawShape>;
        return {
          ...Object.fromEntries(
            Object.entries(_schema.shape).map(([key]) => [key, undefined]),
          ),
          ...obj,
        };
      },
      set: (obj) => {
        return obj ?? new Set();
      },
      map: (obj) => {
        return obj ?? new Map();
      },
      record: (obj) => {
        return obj ?? {};
      },
      null: (obj) => {
        return obj ?? null;
      },
      undefined: (obj) => {
        return obj ?? undefined;
      },
      array: (obj, schema) => {
        if (obj) return obj;
        const exactLength = extractCheck<$ZodCheckLengthEqualsDef>(
          schema.def.checks,
          "length_equals",
        )?.length;
        if (exactLength !== undefined)
          return Array(exactLength).fill(undefined);
        const minLength = extractCheck<$ZodCheckMinLengthDef>(
          schema.def.checks,
          "min_length",
        )?.minimum;
        if (minLength !== undefined) return Array(minLength).fill(undefined);
        return [];
      },
      tuple: (obj, schema) => {
        return (
          obj ??
          Array((schema as z.ZodTuple).def.items.length ?? 0).fill(undefined)
        );
      },
      literal: (obj, schema) => {
        return obj ?? (schema as z.ZodLiteral).value;
      },
      default: (obj, schema) => {
        const defaultValue = schema.def.defaultValue;
        return (
          obj ??
          (typeof defaultValue === "function"
            ? defaultValue()
            : schema.def.defaultValue)
        );
      },
    } as PreprocessorDef,
  );
};

