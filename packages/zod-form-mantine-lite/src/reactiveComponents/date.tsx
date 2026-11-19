import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  emptinessOf,
  emptyValueOf,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { useZodFormContext } from "@zodapp/zod-form-react/common";
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
import { useLocale } from "@zodapp/i18n-messages-react";

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
  outer,
  readOnly: readOnlyProp,
}: ZodFormProps<DateSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const { timezone } = useZodFormContext();
  const meta = useResolvedMeta(schema, "date");
  const locale = useLocale();
  const readOnly = meta?.readOnly ?? readOnlyProp;
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

  const { value, onChange, hasPendingChange, onConfirm, onBlur, onCancel } =
    useConfirmableState(pickerDefault, fieldPath, {
      emptyValue: emptyValueOf({ optional, nullable }),
      // ピッカーの文字列を、保存の形式（Date・数値・文字列）に直して渡す。
      // 元の値から変えていなければ、元の値をそのまま渡す（ピッカーの粒度で丸めない）
      toValue: (raw) =>
        raw === pickerDefault ? defaultValue : converter.fromPickerValue(raw),
    });

  if (readOnly) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{value ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <DateInput
      value={value}
      onChange={(next) => onChange(next)}
      onBlur={() => void onBlur()}
      valueFormat={valueFormat}
      locale={locale}
      label={label || undefined}
      required={!(optional || nullable)}
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
