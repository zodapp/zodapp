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
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type BigIntSchema = ReturnType<typeof zf.bigint>;

const BigIntComponent = wrapComponent(function BigIntComponentImplement({
  schema,
  field,
  label: labelFromParent,
  outer,
  readOnly,
  error,
}: ZodFormInternalProps<BigIntSchema>) {
  const { optional, nullable } = emptinessOf(outer);
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

  const emptyValue = emptyValueOf({ optional, nullable });
  const tryCommit = useCallback(
    (raw: string) => {
      if (raw === "") {
        field.onChange(emptyValue);
        return;
      }
      if (/^-?\d+$/.test(raw)) {
        field.onChange(BigInt(raw));
        return;
      }
      field.onChange(undefined);
    },
    [field, emptyValue],
  );

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.currentTarget.value;
      // 先頭の「-」と数字だけを受け付ける。それ以外の文字は、打っても貼り付けても欄に入れない
      if (!/^-?\d*$/.test(next)) return;
      setLocalValue(next);
      if (next === "") {
        field.onChange(emptyValue);
      } else if (/^-?\d+$/.test(next)) {
        field.onChange(BigInt(next));
      }
    },
    [field, emptyValue],
  );

  const onBlur = useCallback(() => {
    tryCommit(localValue);
    field.onBlur();
  }, [field, localValue, tryCommit]);

  if (readOnly || field.disabled) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
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
      required={!(optional || nullable)}
      disabled={readOnly || field.disabled}
      inputMode="numeric"
      pattern="-?\\d*"
      style={inputWrapperStyle}
    />
  );
});

export { BigIntComponent as component };
