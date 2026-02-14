import React, { useCallback, useMemo } from "react";
import { InputWrapper, Select, Loader } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { useExternalKeyOptions } from "@zodapp/zod-form-react/utils/externalKey";
import { ReadonlyText } from "./utils/text";
import type z from "zod";

type ExternalKeySchema = z.ZodString;

const ExternalKeyComponent = wrapComponent(
  function ExternalKeyComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ExternalKeySchema>) {
    const meta = getMeta(schema, "externalKey");
    const label = labelFromParent ?? meta?.label;

    const { options, isLoading } = useExternalKeyOptions(schema);

    const { onFocus, ref } = useValidatePrecedingFields(field);

    const onChange = useCallback(
      (value: string | null | undefined) => {
        field.onChange(value || undefined);
      },
      [field],
    );

    const displayLabel = useMemo(() => {
      if (isLoading) return "Loading...";
      if (!field.value) return "";
      const option = options.find((o) => o.value === field.value);
      return option?.label ?? String(field.value);
    }, [isLoading, options, field.value]);

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{displayLabel}</ReadonlyText>
        </InputWrapper>
      );
    }

    // loading中
    if (isLoading) {
      return (
        <Select
          ref={ref}
          value={null}
          data={[]}
          onChange={onChange}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={label || undefined}
          error={error?.message}
          required={required !== false}
          disabled={true}
          rightSection={<Loader size="xs" />}
          placeholder="Loading..."
          mt={5}
        />
      );
    }

    // optionsが空の場合
    if (options.length === 0) {
      return (
        <Select
          ref={ref}
          value={null}
          data={[]}
          onChange={onChange}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={label || undefined}
          error={error?.message}
          required={required !== false}
          disabled={true}
          placeholder="選択肢がありません"
          mt={5}
        />
      );
    }

    // 通常のセレクト表示
    return (
      <Select
        ref={ref}
        value={field.value ?? null}
        data={options}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        allowDeselect={true}
        clearable={true}
        mt={5}
      />
    );
  },
);

export { ExternalKeyComponent as component };
