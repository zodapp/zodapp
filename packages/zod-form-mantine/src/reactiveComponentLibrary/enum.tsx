import React, { useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "../componentLibrary/utils/text";
import { renderSelectOption } from "../componentLibrary/utils/selectOption";
import { useEnumData } from "../componentLibrary/utils/enum";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = React.memo(function EnumComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<EnumSchema>) {
  const { label: labelFromMeta, uiType } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = (defaultValue as string | undefined) ?? null;
  const { value, onChange, hasPendingChange, onConfirm, onCancel } =
    useConfirmableState(rawValue, fieldPath);

  const data = useEnumData(schema);

  const displayLabel = useMemo(() => {
    if (!value) return "";
    const option = data.find((d) => d.value === value);
    return option?.label ?? String(value);
  }, [data, value]);

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{displayLabel}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <Select
      value={value}
      data={data}
      renderOption={uiType === "badge" ? renderSelectOption : undefined}
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

EnumComponent.displayName = "ReactiveEnumComponent";

export { EnumComponent as component };
