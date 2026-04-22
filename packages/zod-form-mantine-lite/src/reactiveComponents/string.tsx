import React from "react";
import { InputWrapper, TextInput } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { ReadonlyText } from "../utils/text";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type StringSchema = z.ZodString;

const StringComponent = React.memo(function StringComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly: readOnlyProp,
}: ZodFormProps<StringSchema>) {
  const meta = getMeta(schema);
  const labelFromMeta = meta?.label;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = typeof defaultValue === "string" ? defaultValue : "";
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
    <TextInput
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      label={label || undefined}
      required={required !== false}
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
    />
  );
});

StringComponent.displayName = "ReactiveStringComponent";

export { StringComponent as component };
