import React, { useCallback } from "react";
import { InputWrapper, Switch } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useEmptiness,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type BooleanSchema = ReturnType<typeof zf.boolean>;

const BooleanComponent = wrapComponent(function BooleanComponentImplement({
  fieldPath,
  schema,
  label: labelFromParent,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<BooleanSchema>) {
  const { optional, nullable } = useEmptiness(fieldPath);
  const { uiType, label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const { onFocus, ref } = useValidatePrecedingFields(field);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      field.onChange(event.currentTarget.checked);
    },
    [field],
  );
  const commonSwitchProps = {
    checked: !!field.value,
    onBlur: field.onBlur,
    onChange: onChange,
    onFocus: onFocus,
    required: !(optional || nullable),
    disabled: readOnly || field.disabled,
  };

  if (uiType === "inline") {
    return (
      <div style={{ paddingTop: 5, paddingBottom: 3 }}>
        <Switch
          ref={ref}
          label={label || undefined}
          labelPosition="left"
          error={error?.message}
          {...commonSwitchProps}
        />
      </div>
    );
  }
  return (
    <InputWrapper
      label={label || undefined}
      required={!(optional || nullable)}
      error={error?.message}
      style={{ ...inputWrapperStyle, marginBottom: 3, marginTop: 3 }}
      labelElement="div"
    >
      <div style={{ paddingTop: 5, paddingBottom: 3 }}>
        <Switch
          size="md"
          ref={ref}
          {...commonSwitchProps}
          required={!(optional || nullable)}
        />
      </div>
    </InputWrapper>
  );
});

export { BooleanComponent as component };
