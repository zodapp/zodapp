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

/** 中に default（prefault）があるか（nullable を挟んでもよい） */
const hasDefault = (schema: z.ZodTypeAny): boolean => {
  const def = schema.def as { type: string; innerType?: z.ZodTypeAny };
  if (def.type === "default" || def.type === "prefault") return true;
  if (def.type === "nullable" && def.innerType)
    return hasDefault(def.innerType);
  return false;
};

/**
 * object のキーを置かなくても、undefined を置いたときと同じ検証結果になるか。
 * zod 4 は、optional でない子（z.unknown()・z.any()・z.custom()・undefined を含む union など）の
 * キーが無いと、子が undefined を受け付けても「expected nonoptional」にする。そういう子のキーは残す
 */
const canOmitUndefinedKey = (schema: z.ZodTypeAny): boolean => {
  if (schema._zod.optin === "optional") return true;
  try {
    return !schema.safeParse(undefined).success;
  } catch {
    return false;
  }
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
      // shape のキーは processor の object が歩くので、ここでは object にするだけ
      object: (obj) => {
        return { ...obj };
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
        // nullable：中が default なら（`.default("x").nullable()`）その値を使う（zod と同じく、
        // nullable は undefined を中に渡す）。optional を含むなら undefined。それ以外は null にする。
        // object・配列・record の空の値（{ x: undefined }・[]・{}）は使わない。nullable な object は
        // null で始まり、「＋」で開くまで中の欄を出さない
        nullable: (obj, schema, context) => {
          const innerType = schema.def.innerType as z.ZodTypeAny;
          if (obj !== undefined) {
            return context.transform(obj, [z.null(), innerType]);
          }
          if (hasDefault(innerType)) {
            const inner = context.transform(undefined, innerType);
            if (inner !== undefined) return inner;
          }
          return acceptsUndefined(innerType) ? undefined : null;
        },
        // object：shape のキーをすべて歩いて子の値を作り、値が undefined になったキーは置かない
        // （{ x: undefined } ではなく {}）。ただし、キーが無いと検証結果が変わる子のキーは残す。
        // shape にないキーは catchall があれば変換し、なければ素通しする
        object: (obj, schema, context) => {
          if (typeof obj !== "object" || obj === null) return obj;
          const shape = schema.shape as Record<string, z.ZodTypeAny>;
          const catchall = schema.def.catchall as z.ZodTypeAny | undefined;
          const result: Record<string, unknown> = {};
          for (const key of new Set([
            ...Object.keys(obj),
            ...Object.keys(shape),
          ])) {
            const childSchema = Object.hasOwn(shape, key)
              ? shape[key]
              : catchall;
            const value = childSchema
              ? context.transform(obj[key], childSchema, key)
              : obj[key];
            if (
              value !== undefined ||
              (childSchema !== undefined && !canOmitUndefinedKey(childSchema))
            ) {
              result[key] = value;
            }
          }
          return result;
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
