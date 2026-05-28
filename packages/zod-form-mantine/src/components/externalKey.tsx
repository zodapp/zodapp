import React, { useCallback, useMemo } from "react";
import { ActionIcon, Group, InputWrapper, Loader, Select } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";
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
    const actionWrapper = useExternalKeyAction(schema, field.value);

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

    const actionContent = actionWrapper
      ? actionWrapper(
          <ActionIcon
            component="span"
            size="md"
            variant="subtle"
            aria-label={`${label ?? "選択済み項目"}を開く`}
            style={
              {
                "--ai-color": "var(--zod-form-external-key-action-color)",
                "--ai-hover": "var(--zod-form-external-key-action-hover-color)",
              } as React.CSSProperties
            }
          >
            <IconExternalLink size={16} />
          </ActionIcon>,
        )
      : null;

    if (readOnly || field.disabled) {
      return (
        <InputWrapper
          label={label || undefined}
          labelElement="div"
          style={inputWrapperStyle}
        >
          <Group gap="0" wrap="nowrap" align="center">
            <ReadonlyText style={{ flex: 1 }}>{displayLabel}</ReadonlyText>
            {actionContent}
          </Group>
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
          style={inputWrapperStyle}
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
          style={inputWrapperStyle}
        />
      );
    }

    // 通常のセレクト表示
    const select = (
      <Select
        ref={ref}
        value={field.value ?? null}
        data={options}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        searchable={true}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        allowDeselect={true}
        clearable={true}
        style={inputWrapperStyle}
      />
    );

    if (!actionContent) {
      return select;
    }

    return (
      <Group gap="0" wrap="nowrap" align="flex-end">
        <div style={{ flex: 1 }}>{select}</div>
        {actionContent}
      </Group>
    );
  },
);

export { ExternalKeyComponent as component };
