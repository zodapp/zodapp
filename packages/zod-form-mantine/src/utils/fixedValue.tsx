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

/** 欄として何も出さない固定値か（入れ物の並びに場所を取らないようにするため） */
export const isHiddenFixedValueSchema = (schema: z.ZodTypeAny): boolean =>
  fixedValueOf(schema) !== undefined && !isShownFixedValue(schema);

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
