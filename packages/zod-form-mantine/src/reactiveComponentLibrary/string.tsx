import React from "react";
import { InputWrapper, TextInput } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { ReadonlyText } from "../componentLibrary/utils/text";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";

type StringSchema = z.ZodString;

const StringComponent = React.memo(function StringComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<StringSchema>) {
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = typeof defaultValue === "string" ? defaultValue : "";
  const { value, onChange, hasPendingChange, onConfirm, onCancel, onKeyDown } =
    useConfirmableState(rawValue, fieldPath);

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
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
      mt={5}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
    />
  );
});

StringComponent.displayName = "ReactiveStringComponent";

export { StringComponent as component };
