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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Map) &&
  !(value instanceof Set);

/** schema（object や union の腕）が持つ literal の欄の値（zod 4 の propValues） */
const propValuesOf = (
  schema: z.ZodTypeAny,
): Record<string, Set<unknown>> | undefined =>
  (schema._zod as { propValues?: Record<string, Set<unknown>> }).propValues;

/**
 * 値がある union で、補うときに歩く腕を選ぶ。zf.union の部品が腕を決める規則にそろえる。
 *
 * 1. discriminatedUnion なら、discriminator の値が一致する腕
 * 2. 値がそのまま検証に通る腕があれば、その最初の腕
 * 3. literal の欄の値が一致する腕が 1 つだけなら、その腕
 * 4. 決められなければ undefined（値をそのまま残す）
 */
const pickUnionOption = (
  value: unknown,
  options: z.ZodTypeAny[],
  discriminator: string | undefined,
): z.ZodTypeAny | undefined => {
  if (discriminator !== undefined && isPlainObject(value)) {
    const key = value[discriminator];
    const matched = options.find((option) =>
      propValuesOf(option)?.[discriminator]?.has(key),
    );
    if (matched) return matched;
  }
  const passed = options.find((option) => option.safeParse(value).success);
  if (passed) return passed;
  if (!isPlainObject(value)) return undefined;
  const byLiteral = options.filter((option) => {
    const propValues = propValuesOf(option);
    if (!propValues) return false;
    const keys = Object.keys(propValues).filter((key) =>
      Object.hasOwn(value, key),
    );
    return (
      keys.length > 0 && keys.every((key) => propValues[key]!.has(value[key]))
    );
  });
  return byLiteral.length === 1 ? byLiteral[0] : undefined;
};

/**
 * Zod スキーマから「フォーム初期化向け」のデフォルト値を生成します。
 *
 * `z.default(...)` の defaultValue だけでなく、object/array/set/map なども「空の値」を補完します。
 *
 * `value` を渡すと、その値を持ったまま schema を歩き、値が undefined のところだけを補います
 * （配列の各要素・record の各値・union の腕の中も補う）。入っている値は変えません。
 * 補えないとき（schema の形と値が合わないなど）は、値をそのまま返します。
 */
export const getDefaultValue = (schema: z.ZodTypeAny, value?: unknown) => {
  if (value === undefined) return fillDefaults(undefined, schema);
  try {
    return fillDefaults(value, schema);
  } catch {
    return value;
  }
};

const fillDefaults = (value: unknown, schema: z.ZodTypeAny) => {
  return preprocess(
    value,
    schema,
    {
      // shape のキーは processor の object が歩くので、ここでは object にするだけ
      object: (obj) => {
        return obj === undefined ? {} : obj;
      },
      set: (obj) => {
        return obj !== undefined ? obj : new Set();
      },
      map: (obj) => {
        return obj !== undefined ? obj : new Map();
      },
      record: (obj) => {
        return obj !== undefined ? obj : {};
      },
      null: (obj) => {
        return obj !== undefined ? obj : null;
      },
      undefined: (obj) => {
        return obj;
      },
      array: (obj, schema) => {
        if (obj !== undefined) return obj;
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
        return obj !== undefined
          ? obj
          : Array((schema as z.ZodTuple).def.items.length ?? 0).fill(undefined);
      },
      literal: (obj, schema) => {
        return obj !== undefined ? obj : (schema as z.ZodLiteral).value;
      },
      default: (obj, schema) => {
        const defaultValue = schema.def.defaultValue;
        if (obj !== undefined) return obj;
        return typeof defaultValue === "function"
          ? defaultValue()
          : schema.def.defaultValue;
      },
    } as PreprocessorDef,
    {
      processor: {
        // optional：値が無ければ undefined のまま、値があれば中で歩く
        // （zod-transform の既定は [z.undefined(), 中] を試し、入力途中の値では通らずに投げるため）
        optional: (obj, schema, context) =>
          obj === undefined
            ? undefined
            : context.transform(obj, schema.def.innerType as z.ZodTypeAny),
        // nullable：中が default なら（`.default("x").nullable()`）その値を使う（zod と同じく、
        // nullable は undefined を中に渡す）。optional を含むなら undefined。それ以外は null にする。
        // object・配列・record の空の値（{ x: undefined }・[]・{}）は使わない。nullable な object は
        // null で始まり、「＋」で開くまで中の欄を出さない
        nullable: (obj, schema, context) => {
          const innerType = schema.def.innerType as z.ZodTypeAny;
          // 値があるときは、null なら null のまま、それ以外は中で歩く
          if (obj === null) return null;
          if (obj !== undefined) return context.transform(obj, innerType);
          if (hasDefault(innerType)) {
            const inner = context.transform(undefined, innerType);
            if (inner !== undefined) return inner;
          }
          return acceptsUndefined(innerType) ? undefined : null;
        },
        // object：shape のキーをすべて歩いて子の値を作り、値が undefined になったキーは置かない
        // （{ x: undefined } ではなく {}）。ただし、キーが無いと検証結果が変わる子のキーは残す。
        // shape にないキーは catchall があれば変換し、なければ素通しする。
        // 値に元からあるキーは、undefined でも残す（入っている値の形を変えない）
        object: (obj, schema, context) => {
          if (!isPlainObject(obj)) return obj;
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
              Object.hasOwn(obj, key) ||
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
          const option = pickUnionOption(
            obj,
            options,
            (schema.def as { discriminator?: string }).discriminator,
          );
          return option ? context.transform(obj, option) : obj;
        },
      },
    },
  );
};
