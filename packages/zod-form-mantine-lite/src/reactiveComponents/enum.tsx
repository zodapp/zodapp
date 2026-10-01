import React, { useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "../utils/text";
import { renderSelectOption } from "../utils/selectOption";
import {
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
} from "../utils/enum";
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

  const rawValue = (defaultValue as string | number | undefined) ?? null;
  const { value, onChange, hasPendingChange, onConfirm, onBlur, onCancel } =
    useConfirmableState(rawValue, fieldPath);

  const data = useEnumData(schema);

  // 数値の選択肢も扱えるよう、Select とは文字列でやりとりする (0 も値として残す)
  const optionValue = toEnumOptionValue(value);

  const displayLabel = useMemo(() => {
    if (optionValue === null) return "";
    const option = data.find((d) => d.value === optionValue);
    return option?.label ?? optionValue;
  }, [data, optionValue]);

  if (readOnly) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{displayLabel}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <Select
      value={optionValue}
      data={data}
      renderOption={uiType === "badge" ? renderSelectOption : undefined}
      onChange={(next) => onChange(fromEnumOptionValue(schema, next) ?? null)}
      onBlur={() => void onBlur()}
      label={label || undefined}
      searchable
      required={required !== false}
      allowDeselect
      clearable
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: optionValue !== null ? 24 : 0,
      })}
    />
  );
});

EnumComponent.displayName = "ReactiveEnumComponent";

export { EnumComponent as component };
