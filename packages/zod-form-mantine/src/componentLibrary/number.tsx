import React, { useCallback } from "react";
import { InputWrapper, NumberInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta, zf } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";

type NumberSchema = ReturnType<typeof zf.number>;

const NumberComponent = wrapComponent(function NumberComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<NumberSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const value = typeof field.value === "number" ? field.value : undefined;

  const onChange = useCallback(
    (value: string | number | null | undefined) => {
      if (value === "" || value === null || value === undefined) {
        field.onChange(undefined);
        return;
      }
      const numeric = typeof value === "number" ? value : Number(value);
      field.onChange(Number.isNaN(numeric) ? undefined : numeric);
    },
    [field],
  );

  if (readOnly || field.disabled) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{value}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <NumberInput
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={field.onBlur}
      onFocus={onFocus}
      label={label || undefined}
      error={error?.message}
      required={required !== false}
      disabled={readOnly || field.disabled}
      min={schema.minValue ?? undefined}
      max={schema.maxValue ?? undefined}
      mt={5}
    />
  );
});

export { NumberComponent as component };
