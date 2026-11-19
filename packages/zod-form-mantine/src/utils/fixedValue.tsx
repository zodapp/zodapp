import React from "react";
import { Input, Text } from "@mantine/core";
import type { z } from "zod";
import {
  type ZodFormInternalProps,
  wrapComponent,
  useResolvedMeta,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

/**
 * 値が 1 つに決まる型（固定値）の値。固定値でなければ undefined を返す
 * （`{ value }` で包むのは、固定値の undefined・void と区別するため）。
 * - 値が 1 つの literal：その値
 * - `z.null()`：null
 * - `z.undefined()`・`z.void()`：undefined
 * - `z.nan()`：NaN（比べ方は `Object.is` なので、NaN 同士は等しい）
 */
export const fixedValueOf = (
  schema: z.ZodTypeAny,
): { value: unknown } | undefined => {
  switch (schema.type) {
    case "literal": {
      const values = (schema.def as { values?: unknown[] }).values ?? [];
      return values.length === 1 ? { value: values[0] } : undefined;
    }
    case "null":
      return { value: null };
    case "undefined":
    case "void":
      return { value: undefined };
    case "nan":
      return { value: NaN };
    default:
      return undefined;
  }
};

/**
 * 固定値の欄を見せるか。meta で `hidden: false` と明示したときだけ見せる。
 * null・undefined・void は中身が無いので、`hidden: false` でも見せない
 */
const isShownFixedValue = (schema: z.ZodTypeAny): boolean => {
  const fixed = fixedValueOf(schema);
  if (!fixed || fixed.value === undefined || fixed.value === null) return false;
  return getMeta(schema)?.hidden === false;
};

/** 欄を出さず、値をそのまま保つ型（{@link KeepValueComponent}） */
const KEPT_VALUE_TYPES = new Set([
  "any",
  "unknown",
  "custom",
  "symbol",
  "function",
  "never",
]);

/**
 * 欄を出さず、値をそのまま保つ型か。zf の型（zf.dynamic・zf.computed など。土台が z.unknown・z.never）は、
 * それぞれの部品で描くので当たらない
 */
export const isKeptValueSchema = (schema: z.ZodTypeAny): boolean => {
  if (!KEPT_VALUE_TYPES.has(schema.type)) return false;
  const typeName = getMeta(schema)?.typeName;
  return (
    typeName === undefined ||
    typeName === schema.type ||
    typeName === "common" ||
    typeName === "hidden"
  );
};

/** 欄として何も出さない固定値・値を保つ型か（入れ物の並びに場所を取らないようにするため） */
export const isHiddenFixedValueSchema = (schema: z.ZodTypeAny): boolean =>
  (fixedValueOf(schema) !== undefined && !isShownFixedValue(schema)) ||
  isKeptValueSchema(schema);

const displayOf = (value: unknown) =>
  typeof value === "bigint" ? `${value}n` : String(value);

/**
 * 固定値（値が 1 つの literal・null・undefined・void）の部品。
 *
 * - 既定では出さない（ラベルも出さない）。meta で `hidden: false` のときだけ、readOnly と同じ表示で
 *   スキーマの値を出す（必須の印は付けない）
 * - 値は書き込まない。値は `getDefaultValue` が入れる（AutoForm は開くときに通す）
 * - 入力できないので、前の欄を検証するしくみ（`useValidatePrecedingFields`）には登録しない
 * - 値が固定値と違うなど、この欄にエラーが出たときは、隠していてもエラーだけは出す
 */
export const FixedValueComponent = wrapComponent(
  function FixedValueComponentImplement({
    schema,
    label: labelFromParent,
    error,
  }: ZodFormInternalProps<z.ZodTypeAny>) {
    const meta = useResolvedMeta(schema);
    const fixed = fixedValueOf(schema);

    if (!fixed || !isShownFixedValue(schema)) {
      return error?.message ? (
        <Text c="red" size="sm">
          {error.message}
        </Text>
      ) : null;
    }

    const label = labelFromParent ?? (meta as { label?: string })?.label;
    return (
      <Input.Wrapper
        label={label || undefined}
        error={error?.message}
        style={inputWrapperStyle}
      >
        <Text size="sm" c="dimmed">
          {displayOf(fixed.value)}
        </Text>
      </Input.Wrapper>
    );
  },
);

/**
 * 欄を出さず、値をそのまま保つ部品（`z.any()`・`z.unknown()`・zf の型でない `z.custom()`・
 * `z.symbol()`・`z.function()`・`z.never()`）。
 *
 * - 欄は出さない（`hidden: false` でも中身は出さない）。値は書き込まず、そのまま送る
 * - 値が無いなど、この欄にエラーが出たときは、エラーだけを出す（固定値と同じ）
 */
export const KeepValueComponent = wrapComponent(
  function KeepValueComponentImplement({
    error,
  }: ZodFormInternalProps<z.ZodTypeAny>) {
    return error?.message ? (
      <Text c="red" size="sm">
        {error.message}
      </Text>
    ) : null;
  },
);
