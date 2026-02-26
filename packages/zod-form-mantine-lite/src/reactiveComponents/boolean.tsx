import React from "react";
import { Group, InputWrapper, Switch } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  useConfirmableState,
  ConfirmableInputActions,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type BooleanSchema = ReturnType<typeof zf.boolean>;

const BooleanComponent = React.memo(function BooleanComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<BooleanSchema>) {
  const { uiType, label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = !!defaultValue;
  const { value, onChange, hasPendingChange, onConfirm, onCancel } =
    useConfirmableState(rawValue, fieldPath);

  const switchElement = (
    <Switch
      checked={value}
      onChange={(event) => onChange(event.currentTarget.checked)}
      disabled={readOnly}
      size="md"
      required={required !== false}
    />
  );

  if (uiType === "inline") {
    return (
      <div style={{ paddingTop: 5, paddingBottom: 3 }}>
        <Group gap="sm" align="center">
          <Switch
            checked={value}
            onChange={(event) => onChange(event.currentTarget.checked)}
            disabled={readOnly}
            label={label || undefined}
            labelPosition="left"
            required={required !== false}
          />
          {hasPendingChange && (
            <ConfirmableInputActions
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          )}
        </Group>
      </div>
    );
  }

  return (
    <InputWrapper
      label={label || undefined}
      required={required !== false}
      style={{ ...inputWrapperStyle, marginBottom: 3, marginTop: 3 }}
      labelElement="div"
    >
      <div style={{ paddingTop: 5, paddingBottom: 3 }}>
        <Group gap="sm" align="center">
          {switchElement}
          {hasPendingChange && (
            <ConfirmableInputActions
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          )}
        </Group>
      </div>
    </InputWrapper>
  );
});

BooleanComponent.displayName = "ReactiveBooleanComponent";

export { BooleanComponent as component };
