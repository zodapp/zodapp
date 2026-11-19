import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { Group, InputWrapper, Switch } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { emptinessOf } from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";
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
  outer,
  readOnly: readOnlyProp,
}: ZodFormProps<BooleanSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const meta = useResolvedMeta(schema);
  const uiType = meta?.uiType;
  const labelFromMeta = meta?.label;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = !!defaultValue;
  const { value, onChange, hasPendingChange, onConfirm, onBlur, onCancel } =
    useConfirmableState(rawValue, fieldPath);

  const switchElement = (
    <Switch
      checked={value}
      onChange={(event) => onChange(event.currentTarget.checked)}
      onBlur={() => void onBlur()}
      disabled={readOnly}
      size="md"
      required={!(optional || nullable)}
    />
  );

  if (uiType === "inline") {
    return (
      <div style={{ paddingTop: 5, paddingBottom: 3 }}>
        <Group gap="sm" align="center">
          <Switch
            checked={value}
            onChange={(event) => onChange(event.currentTarget.checked)}
            onBlur={() => void onBlur()}
            disabled={readOnly}
            label={label || undefined}
            labelPosition="left"
            required={!(optional || nullable)}
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
      required={!(optional || nullable)}
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
