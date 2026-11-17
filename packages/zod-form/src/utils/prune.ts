import {
  $remove,
  preprocess,
  type PreprocessorDef,
  type ProcessorDef,
} from "@zodapp/zod-transform";
import type { z } from "zod";
import { getDefaultValue } from "./default";

/* eslint-disable @typescript-eslint/no-explicit-any */

const remove = (): never => $remove() as never;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * 新しい schema に移せない基本型の値と、schema に無い object のキーだけを取り除く。
 * min / max などの制約違反は、フォームで直せるように残す。
 */
const valuePreprocessors: PreprocessorDef = {
  string: (value) => (typeof value === "string" ? value : remove()),
  number: (value) =>
    typeof value === "number" && !Number.isNaN(value) ? value : remove(),
  boolean: (value) => (typeof value === "boolean" ? value : remove()),
  bigint: (value) => (typeof value === "bigint" ? value : remove()),
  date: (value) =>
    value instanceof Date && !Number.isNaN(value.getTime()) ? value : remove(),
  symbol: (value) => (typeof value === "symbol" ? value : remove()),
  null: (value) => (value === null ? value : remove()),
  undefined: (value) => (value === undefined ? value : remove()),
  void: (value) => (value === undefined ? value : remove()),
  nan: (value) =>
    typeof value === "number" && Number.isNaN(value) ? value : remove(),
  never: () => remove(),
  literal: (value, schema: any) =>
    schema.safeParse(value).success ? value : remove(),
  // 選択肢と型が合わない値だけを消す。選択肢から外れただけの値をどうするかは、
  // enum の部品が unlisted で決める（ここでは決めない）
  enum: (value, schema: any) =>
    schema.safeParse(value).success ||
    (schema.options as unknown[]).some(
      (option) => typeof option === typeof value,
    )
      ? value
      : remove(),
  object: (value, schema: any) => {
    if (!isPlainRecord(value)) return remove();
    const allowedKeys = new Set(Object.keys(schema.shape));
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => allowedKeys.has(key)),
    );
  },
  array: (value) => (Array.isArray(value) ? value : remove()),
  tuple: (value) => (Array.isArray(value) ? value : remove()),
  record: (value) => (isPlainRecord(value) ? value : remove()),
  map: (value) => (value instanceof Map ? value : remove()),
  set: (value) => (value instanceof Set ? value : remove()),
};

const valueProcessors: ProcessorDef = {
  optional: (value, schema: any, context) =>
    value === undefined
      ? undefined
      : context.transform(value, schema.def.innerType),
  nullable: (value, schema: any, context) =>
    value === null ? null : context.transform(value, schema.def.innerType),
  // 値が無くても既定値は入れない（入力していない欄を勝手に埋めない）
  default: (value, schema: any, context) =>
    value === undefined
      ? undefined
      : context.transform(value, schema.def.innerType),
  union: (value, schema: any, context) => {
    const option = (schema.def.options as z.ZodTypeAny[]).find(
      (candidate) => candidate.safeParse(value).success,
    );
    return option === undefined ? remove() : context.transform(value, option);
  },
};

/**
 * 値を schema に合わせて削る。schema が変わったとき（`zf.dynamic` の resolve の
 * 結果が変わったときなど）に、前の schema の値を新しい schema へ移すのに使う。
 *
 * - schema に無い object のキーを消す
 * - 型の合わない基本型の値、合わない literal の値、選択肢と型が合わない enum の値を消す
 *   （選択肢から外れただけの enum の値は残す。どうするかは enum の部品が unlisted で決める）
 * - union は値が通る腕に合わせる（どの腕も通らなければ消す）
 * - min / max などの制約違反は残す
 */
export const pruneValueToSchema = (
  value: unknown,
  schema: z.ZodTypeAny,
): unknown =>
  preprocess(value, schema, valuePreprocessors, {
    processor: valueProcessors,
  });

/**
 * 値を新しい schema に合わせる。{@link pruneValueToSchema} で合わない値を消し、
 * 値が無いところを既定値（{@link getDefaultValue} に値を渡したもの）で補う。
 * 配列の各要素・record の各値・union の腕の中も補う。
 */
export const adaptValueToSchema = (
  value: unknown,
  schema: z.ZodTypeAny,
): unknown => getDefaultValue(schema, pruneValueToSchema(value, schema));
