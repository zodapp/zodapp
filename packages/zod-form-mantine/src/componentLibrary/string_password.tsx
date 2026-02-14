import React, { useCallback, useMemo } from "react";
import { InputWrapper, PasswordInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";
import z from "zod";

type StringSchema = z.ZodString;

const StringPasswordComponent = wrapComponent(
  function StringPasswordComponentImplement({
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

    const maskedValue = useMemo(
      () => "●".repeat(value.length),
      [value.length],
    );

    const onChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        field.onChange(event.currentTarget.value || undefined);
      },
      [field],
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{maskedValue}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <PasswordInput
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
      />
    );
  },
);

export { StringPasswordComponent as component };
