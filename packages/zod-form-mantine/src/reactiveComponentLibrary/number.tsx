import React from "react";
import { InputWrapper, NumberInput } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta, zf } from "@zodapp/zod-form";
import { ReadonlyText } from "../componentLibrary/utils/text";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../componentLibrary/utils/styles";

type NumberSchema = ReturnType<typeof zf.number>;

const NumberComponent = React.memo(function NumberComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<NumberSchema>) {
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const rawValue =
    typeof defaultValue === "number" ? defaultValue : ("" as string | number);
  const { value, onChange, hasPendingChange, onConfirm, onCancel, onKeyDown } =
    useConfirmableState(rawValue, fieldPath);

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
