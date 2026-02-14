import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InputWrapper, TextInput } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";
import z from "zod";

type StringSchema = z.ZodString;

const StringLazyComponent = wrapComponent(
  function StringLazyComponentImplement({
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

    // local value (入力中に保持し、blur でのみ form に反映)
    const [localValue, setLocalValue] = useState<string>(field.value ?? "");
    // 直近のフォーム値を保持して、外部更新があったときだけ同期する
    const lastFormValueRef = useRef<string | undefined>(field.value);

    useEffect(() => {
      if (field.value !== lastFormValueRef.current) {
        lastFormValueRef.current = field.value;
        setLocalValue(field.value ?? "");
      }
    }, [field.value]);

    const onChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(event.target.value);
      },
      [],
    );

    const onBlur = useCallback(() => {
      field.onChange(localValue || undefined);
      field.onBlur();
    }, [field, localValue]);

    const disabled = useMemo(
      () => readOnly || field.disabled,
      [field.disabled, readOnly],
    );

    if (readOnly || field.disabled) {
      return (
        <InputWrapper label={label || undefined} mt={5}>
          <ReadonlyText>{value}</ReadonlyText>
        </InputWrapper>
      );
    }

    return (
      <TextInput
        ref={ref}
        value={localValue}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        label={label || undefined}
        error={error?.message}
        required={required !== false}
        disabled={disabled}
        mt={5}
      />
    );
  },
);

StringLazyComponent.displayName = "StringLazyComponent";

export { StringLazyComponent as component };
