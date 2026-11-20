import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { InputWrapper, Textarea } from "@mantine/core";
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
import { inputWrapperStyle, stringMultilineStyles } from "../utils/styles";

type StringSchema = z.ZodString;

const StringMultilineComponent = React.memo(function StringMultilineComponent({
  schema,
  fieldPath,
  value: valueProp,
  label: labelFromParent,
  outer,
  readOnly: readOnlyProp,
}: ZodFormProps<StringSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const meta = useResolvedMeta(schema);
  const labelFromMeta = meta?.label;
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const label = labelFromParent ?? labelFromMeta;

  const rawValue = typeof valueProp === "string" ? valueProp : "";
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
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{value}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={() => void onBlur()}
      onKeyDown={onKeyDown}
      label={label || undefined}
      placeholder={meta?.placeholder}
      required={!(optional || nullable)}
      autosize
      minRows={3}
      style={inputWrapperStyle}
      styles={stringMultilineStyles}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel)}
      rightSectionProps={{
        style: { alignItems: "flex-end", paddingBottom: 6 },
      }}
    />
  );
});

StringMultilineComponent.displayName = "ReactiveStringMultilineComponent";

export { StringMultilineComponent as component };
