import React, { useCallback, useMemo } from "react";
import { InputWrapper, MultiSelect, Loader } from "@mantine/core";
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

type ArrayOfExternalKeySchema = z.ZodArray<ExternalKeySchema>;

const ArrayOfExternalKeyComponent = wrapComponent(
  function ArrayOfExternalKeyComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<ArrayOfExternalKeySchema>) {
    const { onFocus, ref } = useValidatePrecedingFields(field);

    // 内側のexternalKeyスキーマを取得
    const externalKeySchema = schema.element as ExternalKeySchema;

    // arrayスキーマ自体のメタからlabelを取得
    const arrayMeta = getMeta(schema);
    const labelFromMeta = arrayMeta?.label;
    const label = labelFromParent ?? labelFromMeta;
    const uiType = arrayMeta?.uiType;

    // 内側のスキーマからoptionsを取得
    const { options, isLoading } = useExternalKeyOptions(externalKeySchema);

    const value = useMemo(
      () => (Array.isArray(field.value) ? field.value : []),
      [field.value],
    );

    const onChange = useCallback(
      (next: string[] | null | undefined) => {
        field.onChange(!next || next.length === 0 ? undefined : next);
      },
      [field],
    );

    const displayLabels = useMemo(() => {
      if (isLoading) return "Loading...";
      return value
        .map((v) => {
          const option = options.find((o) => o.value === v);
          return option?.label ?? String(v);
        })
        .join(", ");
    }, [isLoading, options, value]);

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{displayLabels}</ReadonlyText>
        </InputWrapper>
      );
    }

    // loading中
    if (isLoading) {
      return (
        <MultiSelect
          ref={ref}
          value={[]}
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
        <MultiSelect
          ref={ref}
          value={[]}
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

    // 通常のMultiSelect表示
    return (
      <MultiSelect
        ref={ref}
        value={value}
        data={options}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        clearable={true}
        searchable={true}
        mt={5}
      />
    );
  },
);

export { ArrayOfExternalKeyComponent as component };
