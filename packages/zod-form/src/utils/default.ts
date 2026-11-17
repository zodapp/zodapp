import { PreprocessorDef, preprocess } from "@zodapp/zod-transform";
import z from "zod";
import { $ZodCheckLengthEqualsDef, $ZodCheckMinLengthDef } from "zod/v4/core";
import { extractCheck } from "./zod";

/** optional（間の nullable を通して）なら undefined を受け付ける */
const acceptsUndefined = (schema: z.ZodTypeAny): boolean => {
  const def = schema.def as { type: string; innerType?: z.ZodTypeAny };
  if (def.type === "optional") return true;
  if (def.type === "nullable" && def.innerType)
    return acceptsUndefined(def.innerType);
  return false;
};

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
    {
      processor: {
        // nullable：中が値を作るなら（`.default("x").nullable()` の default など）それを使う。
        // 中が何も作らず、欄が optional でもなければ null にする（zod と同じく、null を引き受けるのは nullable だけ）
        nullable: (obj, schema, context) => {
          const innerType = schema.def.innerType as z.ZodTypeAny;
          if (obj !== undefined) {
            return context.transform(obj, [z.null(), innerType]);
          }
          const inner = context.transform(undefined, innerType);
          if (inner !== undefined) return inner;
          return acceptsUndefined(innerType) ? undefined : null;
        },
        union: (obj, schema, context) => {
          const options = schema.def.options as z.ZodTypeAny[];
          if (obj === undefined) {
            const matchedOption = options.find(
              (option) => option.safeParse(obj).success,
            );
            return matchedOption
              ? context.transform(obj, matchedOption)
              : undefined;
          }
          return context.transform(obj, options);
        },
      },
    },
  );
};
