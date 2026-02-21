import React from "react";
import { InputWrapper, Textarea } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { ReadonlyText } from "../componentLibrary/utils/text";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";

type StringSchema = z.ZodString;

const StringMultilineComponent = React.memo(function StringMultilineComponent({
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
    <Textarea
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      label={label || undefined}
      required={required !== false}
      autosize
      minRows={3}
      mt={5}
      styles={{
        input: {
          maxHeight: "var(--zod-form-string-multiline-max-height, none)",
          overflowY: "auto",
        },
      }}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
      rightSectionProps={{
        style: { alignItems: "flex-end", paddingBottom: 6 },
      }}
    />
  );
});

StringMultilineComponent.displayName = "ReactiveStringMultilineComponent";

export { StringMultilineComponent as component };
