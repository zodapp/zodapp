import React, { useMemo, useRef } from "react";
import z from "zod";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ZodForm, ZodFormProps } from "../utils/type";
import { getMeta } from "@zodapp/zod-form";
import { useZodField } from "./form";

type AdaptedError =
  | {
      message?: string;
      type?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      types?: Record<string, any>;
    }
  | undefined;

type AdaptedField<TValue = unknown> = {
  name?: string;
  value: TValue | undefined;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  ref: (node: HTMLElement | null) => void;
  disabled?: boolean;
  api: AnyFieldApi;
};

type AdaptedFieldState = {
  error?: AdaptedError;
  isTouched?: boolean;
  isDirty?: boolean;
  invalid?: boolean;
  isValidating?: boolean;
};

/**
 * 内部コンポーネント（UI 実装）向けに拡張された props。
 *
 * `ZodFormProps` に加えて、フォームライブラリから取得した `field` 情報や、
 * タッチ/エラー等の状態を合成したものを渡します。
 */
export type ZodFormInternalProps<TSchema extends z.ZodTypeAny = z.ZodTypeAny> =
  ZodFormProps<TSchema> & {
    field: AdaptedField<z.infer<TSchema>>;
  } & Partial<AdaptedFieldState>;

const coerceValueFromEvent = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "target" in (value as Record<string, unknown>)
  ) {
    const target = (value as { target: unknown }).target as
      | { value?: unknown; checked?: unknown }
      | undefined;
    if (target && "checked" in target) {
      return target.checked;
    }
    if (target && "value" in target) {
      return target.value;
    }
  }
  return value;
};

/**
 * 内部 UI コンポーネントを `ZodForm` として扱えるようにラップします。
 *
 * `useZodField()` から field 状態を取得し、`ComponentInternal` に `field` や `error` 等を注入します。
 * `options` で特定 props を内部へ渡さない（マスクする）こともできます。
 */
export const wrapComponent = <TSchema extends z.ZodTypeAny = z.ZodTypeAny>(
  ComponentInternal: React.ComponentType<ZodFormInternalProps<TSchema>>,
  options?: {
    [key in keyof ZodFormInternalProps<TSchema>]?: boolean;
  },
): ZodForm<TSchema> => {
  const ComponentInternalMemoized = React.memo(ComponentInternal);
  const mask = Object.fromEntries(
    Object.entries(options ?? {})
      .filter(([_, value]) => value === false)
      .map(([key]) => [key, null]),
  );
  const ZodFormImplement = (props: ZodFormProps<TSchema>) => {
    const { fieldPath } = props;
    const fieldApi = useZodField<z.infer<TSchema>>(fieldPath, {});
    const refRef = useRef<HTMLElement | null>(null);

    const rawErrors = fieldApi.state.meta.errors;

    const error = rawErrors.flat()[0] as AdaptedError | undefined;

    const showError =
      fieldApi.state.meta.isTouched || fieldApi.form.state.isSubmitted;

    const adaptedFieldState: AdaptedFieldState = {
      error: showError ? error : undefined,
      isTouched: fieldApi.state.meta.isTouched,
      isDirty: fieldApi.state.meta.isDirty,
      invalid: !!error,
      isValidating: fieldApi.state.meta.isValidating,
    };

    const adaptedField: AdaptedField<z.infer<TSchema>> = useMemo(
      () => ({
        name: fieldApi.name,
        value: fieldApi.state.value as z.infer<TSchema>,
        onChange: (next) => {
          const coerced = coerceValueFromEvent(next);
          fieldApi.handleChange(coerced as unknown);
          // blur 由来のエラーは change 後も meta.errors に残るため、表示が消えない。
          // change を発火したタイミングで onBlur エラーをクリアしておく。
          queueMicrotask(() => {
            const errorMap = fieldApi.state.meta.errorMap;
            if (errorMap?.onBlur) {
              fieldApi.setMeta((prev) => ({
                ...prev,
                errorMap: { ...prev.errorMap, onBlur: undefined },
                errorSourceMap: { ...prev.errorSourceMap, onBlur: undefined },
              }));
            }
          });
        },
        onBlur: () => {
          fieldApi.handleBlur();
          // blur直後の同期ループを避けるため、次のtickで全体バリデーションを実行
          queueMicrotask(() => fieldApi.validate("blur"));
        },
        ref: (node: HTMLElement | null) => {
          refRef.current = node;
        },
        disabled: fieldApi.state.meta.isValidating,
        api: fieldApi,
      }),
      [fieldApi],
    );

    const meta = getMeta(props.schema);

    const mergedProps = {
      ...props,
      ...adaptedFieldState,
      field: adaptedField,
      readOnly: meta?.readOnly ?? props.readOnly,
      ...mask,
    };
    return <ComponentInternalMemoized {...mergedProps} />;
  };

  ZodFormImplement.displayName = `ZodForm(${
    ComponentInternal.displayName ?? ComponentInternal.name ?? "ZodFormInner"
  })`;

  return React.memo(ZodFormImplement);
};
