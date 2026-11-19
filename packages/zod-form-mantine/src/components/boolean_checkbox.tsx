import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useCallback } from "react";
import { Checkbox } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";

type BooleanSchema = ReturnType<typeof zf.boolean>;

const BooleanCheckboxComponent = wrapComponent(
  function BooleanCheckboxComponentImplement({
    schema,
    label: labelFromParent,
    outer,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<BooleanSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const { label: labelFromMeta } = useResolvedMeta(schema) ?? {};
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
        required={!(optional || nullable)}
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
