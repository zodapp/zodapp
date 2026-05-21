import React from "react";
import { InputWrapper, NumberInput } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta, zf } from "@zodapp/zod-form";
import { ReadonlyText } from "../utils/text";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type NumberSchema = ReturnType<typeof zf.number>;

const NumberComponent = React.memo(function NumberComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly: readOnlyProp,
}: ZodFormProps<NumberSchema>) {
  const meta = getMeta(schema);
  const labelFromMeta = meta?.label;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue =
    typeof defaultValue === "number" ? defaultValue : ("" as string | number);
  const {
    value,
    onChange,
    hasPendingChange,
    onConfirm,
    onBlur,
    onCancel,
    onKeyDown,
  } = useConfirmableState(rawValue, fieldPath);

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} style={inputWrapperStyle}>
        <ReadonlyText>{value}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <NumberInput
      value={value}
      onChange={(next) => {
        if (next === "" || next === null || next === undefined) {
          onChange("" as string | number);
          return;
        }
        const numeric = typeof next === "number" ? next : Number(next);
        onChange(Number.isNaN(numeric) ? ("" as string | number) : numeric);
      }}
      onBlur={() => void onBlur()}
      onKeyDown={onKeyDown}
      label={label || undefined}
      required={required !== false}
      min={schema.minValue ?? undefined}
      max={schema.maxValue ?? undefined}
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
    />
  );
});

NumberComponent.displayName = "ReactiveNumberComponent";

export { NumberComponent as component };
