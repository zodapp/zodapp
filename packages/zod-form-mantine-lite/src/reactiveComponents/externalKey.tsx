import React, { useMemo } from "react";
import { ActionIcon, Group, InputWrapper, Loader, Select } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
import { ReadonlyText } from "../utils/text";
import type z from "zod";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type ExternalKeySchema = z.ZodString;

const ExternalKeyComponent = React.memo(function ExternalKeyComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<ExternalKeySchema>) {
  const meta = getMeta(schema, "externalKey");
  const label = labelFromParent ?? meta?.label;

  const { options, isLoading } = useExternalKeyOptions(schema);

  const rawValue = (defaultValue as string | undefined) ?? null;
  const { value, onChange, hasPendingChange, onConfirm, onCancel } =
    useConfirmableState(rawValue, fieldPath);
  const actionWrapper = useExternalKeyAction(schema, value);

  const displayLabel = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!value) return "";
    const option = options.find((o) => o.value === value);
    return option?.label ?? String(value);
  }, [isLoading, options, value]);

  const actionContent = actionWrapper
    ? actionWrapper(
        <ActionIcon
          component="span"
          size="md"
          variant="subtle"
          aria-label={`${label ?? "選択済み項目"}を開く`}
          style={{
            color: "var(--mantine-primary-color-filled)",
          }}
        >
          <IconExternalLink size={16} />
        </ActionIcon>,
      )
    : null;

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} style={inputWrapperStyle}>
        <Group gap="xs" wrap="nowrap" align="center">
          <ReadonlyText style={{ flex: 1 }}>{displayLabel}</ReadonlyText>
          {actionContent}
        </Group>
      </InputWrapper>
    );
  }

  if (isLoading) {
    return (
      <Select
        value={null}
        data={[]}
        onChange={() => {}}
        label={label || undefined}
        required={required !== false}
        disabled
        rightSection={<Loader size="xs" />}
        placeholder="Loading..."
        style={inputWrapperStyle}
      />
    );
  }

  if (options.length === 0) {
    return (
      <Select
        value={null}
        data={[]}
        onChange={() => {}}
        label={label || undefined}
        required={required !== false}
        disabled
        placeholder="選択肢がありません"
        style={inputWrapperStyle}
      />
    );
  }

  const select = (
    <Select
      value={value}
      data={options}
      onChange={(next) => onChange(next)}
      label={label || undefined}
      searchable
      required={required !== false}
      allowDeselect
      clearable
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: value ? 24 : 0,
      })}
    />
  );

  if (!actionContent) {
    return select;
  }

  return (
    <Group gap="xs" wrap="nowrap" align="flex-end">
      <div style={{ flex: 1 }}>{select}</div>
      {actionContent}
    </Group>
  );
});

ExternalKeyComponent.displayName = "ReactiveExternalKeyComponent";

export { ExternalKeyComponent as component };
