import React, { useCallback } from "react";
import { Checkbox } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";

type BooleanSchema = ReturnType<typeof zf.boolean>;

const BooleanCheckboxComponent = wrapComponent(
  function BooleanCheckboxComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<BooleanSchema>) {
    const { label: labelFromMeta } = getMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const { onFocus, ref } = useValidatePrecedingFields(field);

    const onChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        field.onChange(event.currentTarget.checked);
      },
      [field],
    );

    return (
      <Checkbox
        ref={ref}
        checked={!!field.value}
        onBlur={field.onBlur}
        onChange={onChange}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={readOnly || field.disabled}
        style={{
          marginBottom: 6,
          marginTop: 6,
          "--checkbox-color": "var(--mantine-primary-color-filled)",
        }}
      />
    );
  },
);

export { BooleanCheckboxComponent as component };
