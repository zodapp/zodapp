/**
 * zodで、深い階層にdefault()が設定されていても、
 * それを収集して、全体としてのdefaultを取得するためのサンプルです
 * あくまでサンプルであり、zod-formでは異なる実装が使われていることに注意してください。
 */

import { PreprocessorDef, preprocess } from "@zodapp/zod-transform";
import z from "zod";

import { $ZodCheckLengthEqualsDef, $ZodCheckMinLengthDef } from "zod/v4/core";

import { $ZodCheck, $ZodCheckDef } from "zod/v4/core";

const extractCheck = <Check extends $ZodCheckDef>(
  checks: $ZodCheck[] | undefined,
  kind: Check["check"],
) => {
  return checks?.find((check) => check._zod.def.check === kind)?._zod
    .def as Check;
};

/**
 * （サンプル）Zod スキーマから default 値を組み立てます。
 *
 * 深い階層に `default()` がある場合も含めて、入力 `undefined` から初期値を生成する例です。
 */
export const getDefaultValue = (schema: z.ZodTypeAny) => {
  return preprocess(
    undefined,
    schema,
    {
      object: (obj) => {
        return obj ?? {};
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
      null: () => {
        return null;
      },
      undefined: () => {
        return undefined;
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
