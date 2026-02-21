import React, { useCallback } from "react";
import { InputWrapper, Textarea } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { ReadonlyText } from "./utils/text";

type StringSchema = z.ZodString;

const StringMultilineComponent = wrapComponent(function StringMultilineComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<StringSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const value = typeof field.value === "string" ? field.value : "";

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      field.onChange(event.target.value || undefined);
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
    <Textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={field.onBlur}
      onFocus={onFocus}
      label={label || undefined}
      error={error?.message}
      required={required !== false}
      disabled={readOnly || field.disabled}
      mt={5}
      autosize
      minRows={3}
      styles={{
        input: {
          maxHeight: "var(--zod-form-string-multiline-max-height, none)",
          overflowY: "auto",
        },
      }}
    />
  );
});

StringMultilineComponent.displayName = "StringMultilineComponent";

export { StringMultilineComponent as component };
