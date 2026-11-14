import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InputWrapper, Select, TextInput } from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";
import {
  createTimeConverter,
  type SupportedTimeSchema,
  type TimeEncoding,
  type TimeUnit,
} from "@zodapp/zod-form-react/utils/timeConverter";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const value = `${String(h).padStart(2, "0")}:00`;
  return { value, label: value };
});

/** HH:mm:ss.SSS を打ち込む欄。読める形になったときだけ値に書く */
const MillisecondInput = ({
  value,
  onCommit,
  ...props
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
} & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChange">) => {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <TextInput
      {...props}
      placeholder="HH:mm:ss.SSS"
      value={draft}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setDraft(next);
        if (next === "") onCommit(null);
        else if (/^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(next)) onCommit(next);
      }}
    />
  );
};

const TimeComponent = wrapComponent(function TimeComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<SupportedTimeSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const meta = getMeta(schema) as
    | { label?: string; unit?: TimeUnit; encoding?: TimeEncoding }
    | undefined;
  const label = labelFromParent ?? meta?.label;
  const unitFromMeta = meta?.unit;
  const encoding = meta?.encoding;

  const converter = useMemo(
    () =>
      createTimeConverter({
        schema: schema as SupportedTimeSchema,
        unit: unitFromMeta,
        encoding,
      }),
    [schema, unitFromMeta, encoding],
  );
  const unit = converter.unit;

  const pickerValue = useMemo(
    () => converter.toPickerValue(field.value),
    [converter, field.value],
  );

  // 値を変えたときだけ、データの持ち方の形式で書く（開いただけでは値に触らない）
  const onChange = useCallback(
    (next: string | null) => {
      field.onChange(converter.fromPickerValue(next));
    },
    [converter, field],
  );

  if (readOnly || field.disabled) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{pickerValue ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  const commonProps = {
    onBlur: field.onBlur,
    onFocus,
    label: label || undefined,
    error: error?.message,
    required: required !== false,
    style: inputWrapperStyle,
  };

  switch (unit) {
    case "hour":
      return (
        <Select
          {...commonProps}
          ref={ref}
          data={HOUR_OPTIONS}
          value={pickerValue}
          onChange={onChange}
          clearable
        />
      );
    case "millisecond":
      return (
        <MillisecondInput
          {...commonProps}
          ref={ref}
          value={pickerValue}
          onCommit={onChange}
        />
      );
    case "minute":
    case "second":
    default:
      return (
        <TimePicker
          {...commonProps}
          hoursRef={ref}
          value={pickerValue ?? ""}
          onChange={(next) => onChange(next === "" ? null : next)}
          withSeconds={unit === "second"}
          clearable
        />
      );
  }
});

export { TimeComponent as component };
