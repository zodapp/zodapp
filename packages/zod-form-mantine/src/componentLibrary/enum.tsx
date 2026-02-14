import React, { useCallback, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { renderSelectOption } from "./utils/selectOption";
import { useEnumData } from "./utils/enum";
import { ReadonlyText } from "./utils/text";

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
      field.onChange(value || undefined);
    },
    [field],
  );

  const data = useEnumData(schema);

  const displayLabel = useMemo(() => {
    if (!field.value) return "";
    const option = data.find((d) => d.value === field.value);
    return option?.label ?? String(field.value);
  }, [data, field.value]);

  if (readOnly || field.disabled) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{displayLabel}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <Select
      ref={ref}
      value={field.value ?? null}
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
      mt={5}
    />
  );
});

export { EnumComponent as component };
