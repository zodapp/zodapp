import React, { useCallback } from "react";
import { InputWrapper, NumberInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta, zf } from "@zodapp/zod-form";
import { ReadonlyText, inputWrapperStyle, renderComputedValue } from "@zodapp/zod-form-mantine-lite/utils";

type NumberSchema = ReturnType<typeof zf.number>;

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? undefined : numeric;
};

const NumberComponent = wrapComponent(function NumberComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<NumberSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { label: labelFromMeta, formatter } = getMeta(schema, "number") ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const rawValue = field.value as unknown;

  const value = toNumberValue(rawValue);

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
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        {value !== undefined && formatter
          ? renderComputedValue(formatter(value), "readOnly")
          : <ReadonlyText>{value}</ReadonlyText>}
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
      style={inputWrapperStyle}
    />
  );
});

export { NumberComponent as component };
