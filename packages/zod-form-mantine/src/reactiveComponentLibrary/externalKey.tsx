import React, { useMemo } from "react";
import { InputWrapper, Select, Loader } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { useExternalKeyOptions } from "@zodapp/zod-form-react/utils/externalKey";
import { ReadonlyText } from "../componentLibrary/utils/text";
import type z from "zod";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";

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

  const displayLabel = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!value) return "";
    const option = options.find((o) => o.value === value);
    return option?.label ?? String(value);
  }, [isLoading, options, value]);

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{displayLabel}</ReadonlyText>
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
        mt={5}
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
        mt={5}
      />
    );
  }

  return (
    <Select
      value={value}
      data={options}
      onChange={(next) => onChange(next)}
      label={label || undefined}
      searchable
      required={required !== false}
      allowDeselect
      clearable
      mt={5}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: value ? 24 : 0,
      })}
    />
  );
});

ExternalKeyComponent.displayName = "ReactiveExternalKeyComponent";

export { ExternalKeyComponent as component };
