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
import { zf, getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";

type BigIntSchema = ReturnType<typeof zf.bigint>;

const BigIntComponent = wrapComponent(function BigIntComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<BigIntSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  const displayValue =
    typeof field.value === "bigint" ? field.value.toString() : "";

  const initial = useMemo(
    () => (typeof field.value === "bigint" ? field.value.toString() : ""),
    [field.value],
  );
  const [localValue, setLocalValue] = useState(initial);
  const lastFormValueRef = useRef<bigint | undefined>(field.value);

  useEffect(() => {
    if (field.value !== lastFormValueRef.current) {
      lastFormValueRef.current = field.value as bigint | undefined;
      setLocalValue(
        typeof field.value === "bigint" ? field.value.toString() : "",
      );
    }
  }, [field.value]);

  const tryCommit = useCallback(
    (raw: string) => {
      if (raw === "") {
        field.onChange(undefined);
        return;
      }
      if (/^-?\d+$/.test(raw)) {
        field.onChange(BigInt(raw));
        return;
      }
      field.onChange(undefined);
    },
    [field],
  );

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.currentTarget.value;
      setLocalValue(next);
      if (next === "") {
        field.onChange(undefined);
      } else if (/^-?\d+$/.test(next)) {
        field.onChange(BigInt(next));
      }
    },
    [field],
  );

  const onBlur = useCallback(() => {
    tryCommit(localValue);
    field.onBlur();
  }, [field, localValue, tryCommit]);

  if (readOnly || field.disabled) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{displayValue}</ReadonlyText>
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
      disabled={readOnly || field.disabled}
      inputMode="numeric"
      pattern="-?\\d*"
      mt={5}
    />
  );
});

export { BigIntComponent as component };
