import React, { useCallback, useMemo } from "react";
import { InputWrapper, Select } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type BooleanSchema = ReturnType<typeof zf.boolean>;

const TRUE_VALUE = "true";
const FALSE_VALUE = "false";

const BooleanSelectComponent = wrapComponent(
  function BooleanSelectComponentImplement({
    schema,
    label: labelFromParent,
    required,
    readOnly,
    field,
    error,
  }: ZodFormInternalProps<BooleanSchema>) {
    const {
      label: labelFromMeta,
      trueLabel = "はい",
      falseLabel = "いいえ",
    } = getMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;
    const { onFocus, ref } = useValidatePrecedingFields(field);
    const isOptional = required === false;

    const data = useMemo(
      () => [
        { value: TRUE_VALUE, label: trueLabel },
        { value: FALSE_VALUE, label: falseLabel },
      ],
      [falseLabel, trueLabel],
    );

    const value =
      field.value === true
        ? TRUE_VALUE
        : field.value === false
          ? FALSE_VALUE
          : null;

    const onChange = useCallback(
      (next: string | null | undefined) => {
        if (next === TRUE_VALUE) {
          field.onChange(true);
          return;
        }
        if (next === FALSE_VALUE) {
          field.onChange(false);
          return;
        }
        if (isOptional) {
          field.onChange(undefined);
        }
      },
      [field, isOptional],
    );

    const displayLabel =
      field.value === true ? trueLabel : field.value === false ? falseLabel : "";

    if (readOnly || field.disabled) {
      return (
        <InputWrapper
          label={label || undefined}
          labelElement="div"
          style={inputWrapperStyle}
        >
          <ReadonlyText>{displayLabel}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <Select
        ref={ref}
        value={value}
        data={data}
        onChange={onChange}
        onBlur={field.onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={!isOptional}
        disabled={readOnly || field.disabled}
        allowDeselect={isOptional}
        clearable={isOptional}
        style={inputWrapperStyle}
      />
    );
  },
);

export { BooleanSelectComponent as component };
