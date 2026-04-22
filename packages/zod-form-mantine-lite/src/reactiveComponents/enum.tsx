import React, { useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "../utils/text";
import { renderSelectOption } from "../utils/selectOption";
import { useEnumData } from "../utils/enum";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = React.memo(function EnumComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly: readOnlyProp,
}: ZodFormProps<EnumSchema>) {
  const meta = getMeta(schema);
  const labelFromMeta = meta?.label;
  const uiType = meta?.uiType;
  const readOnly = meta?.readOnly ?? readOnlyProp;
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
      <InputWrapper label={label || undefined} style={inputWrapperStyle}>
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
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: value ? 24 : 0,
      })}
    />
  );
});

EnumComponent.displayName = "ReactiveEnumComponent";

export { EnumComponent as component };
