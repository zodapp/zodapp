import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import "dayjs/locale/ja";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { useZodFormContext } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "../utils/text";
import {
  createDateConverter,
  type SupportedDateSchema,
  type DateUnit,
  type DateEncoding,
  type CreateDateConverterParams,
} from "@zodapp/zod-form-react/utils/dateConverter";
import { z } from "zod";
import {
  useConfirmableState,
  confirmableRightSectionProps,
} from "./utils/confirmable";
import { inputWrapperStyle } from "../utils/styles";

type DateSchema = z.ZodDate | z.ZodNumber | z.ZodISODateTime | z.ZodISODate;

const unitToValueFormat: Record<DateUnit, string> = {
  year: "YYYY",
  month: "YYYY-MM",
  day: "YYYY-MM-DD",
  minute: "YYYY-MM-DD HH:mm",
  second: "YYYY-MM-DD HH:mm:ss",
  millisecond: "YYYY-MM-DD HH:mm:ss",
};

const DateComponent = React.memo(function DateComponent({
  schema,
  fieldPath,
  defaultValue,
  label: labelFromParent,
  required,
  readOnly,
}: ZodFormProps<DateSchema>) {
  const { timezone } = useZodFormContext();
  const meta = getMeta(schema) as
    | { label?: string; unit?: DateUnit; encoding?: DateEncoding }
    | undefined;
  const labelFromMeta = meta?.label;
  const unitFromMeta = meta?.unit;
  const encoding = meta?.encoding;
  const label = labelFromParent ?? labelFromMeta;

  const converter = useMemo(() => {
    return createDateConverter({
      schema: schema as SupportedDateSchema,
      unit: unitFromMeta as DateUnit | undefined,
      encoding: encoding as DateEncoding | undefined,
      timezone,
    } as CreateDateConverterParams);
  }, [schema, unitFromMeta, encoding, timezone]);

  const unit = converter.unit;
  const valueFormat = unitToValueFormat[unit];

  const pickerDefault = useMemo(() => {
    return converter.toPickerValue(defaultValue);
  }, [converter, defaultValue]);

  const { value, onChange, hasPendingChange, onConfirm, onCancel } =
    useConfirmableState(pickerDefault, fieldPath);

  if (readOnly) {
    return (
      <InputWrapper label={label || undefined} style={inputWrapperStyle}>
        <ReadonlyText>{value ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <DateInput
      value={value}
      onChange={(next) => onChange(next)}
      valueFormat={valueFormat}
      locale="ja"
      label={label || undefined}
      required={required !== false}
      clearable
      style={inputWrapperStyle}
      {...confirmableRightSectionProps(hasPendingChange, onConfirm, onCancel, {
        clearableWidth: value ? 24 : 0,
      })}
    />
  );
});

DateComponent.displayName = "ReactiveDateComponent";

export { DateComponent as component };
