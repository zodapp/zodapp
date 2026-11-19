import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { InputWrapper, TextInput } from "@mantine/core";
import {
  emptinessOf,
  emptyValueOf,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
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
  outer,
  readOnly: readOnlyProp,
}: ZodFormProps<StringSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const meta = useResolvedMeta(schema);
  const labelFromMeta = meta?.label;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = typeof defaultValue === "string" ? defaultValue : "";
  const {
    value,
    onChange,
    hasPendingChange,
    onConfirm,
    onBlur,
    onCancel,
    onKeyDown,
  } = useConfirmableState(rawValue, fieldPath, {
    emptyValue: emptyValueOf({ optional, nullable }),
  });

  if (readOnly) {
    return (
      <InputWrapper
        labelElement="div"
        label={label || undefined}
        style={inputWrapperStyle}
      >
        <ReadonlyText>{value}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <TextInput
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={() => void onBlur()}
      onKeyDown={onKeyDown}
      label={label || undefined}
      required={!(optional || nullable)}
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
    />
  );
});

StringComponent.displayName = "ReactiveStringComponent";

export { StringComponent as component };
