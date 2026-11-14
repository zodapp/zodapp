import React, { useCallback, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useSchemaValueAction,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  renderSelectOption,
  useEnumData,
  toEnumOptionValue,
  fromEnumOptionValue,
  ReadonlyText,
  WithValueAction,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = wrapComponent(function EnumComponentImplement({
  schema,
  label: labelFromParent,
  required,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<EnumSchema>) {
  const { label: labelFromMeta, uiType } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const { onFocus, ref } = useValidatePrecedingFields(field);

  const onChange = useCallback(
    (value: string | null | undefined) => {
      field.onChange(fromEnumOptionValue(schema, value));
    },
    [field, schema],
  );

  const data = useEnumData(schema);
  // 数値の選択肢も扱えるよう、Select とは文字列でやりとりする (0 も値として残す)
  const optionValue = toEnumOptionValue(field.value);
  const actionWrapper = useSchemaValueAction(schema, optionValue);

  const displayLabel = useMemo(() => {
    if (optionValue === null) return "";
    const option = data.find((d) => d.value === optionValue);
    return option?.label ?? optionValue;
  }, [data, optionValue]);

  if (readOnly || field.disabled) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <WithValueAction wrapper={actionWrapper} label={label || undefined} align="center">
          <ReadonlyText>{displayLabel}</ReadonlyText>
        </WithValueAction>
      </InputWrapper>
    );
  }

  return (
    <WithValueAction wrapper={actionWrapper} label={label || undefined}>
      <Select
      ref={ref}
      value={optionValue}
      data={data}
      renderOption={uiType === "badge" ? renderSelectOption : undefined}
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
    </WithValueAction>
  );
});

export { EnumComponent as component };
