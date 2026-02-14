import React, { useCallback, useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  DatePickerInput,
  MonthPickerInput,
  YearPickerInput,
  DateTimePicker,
} from "@mantine/dates";
import "dayjs/locale/ja";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useZodFormContext,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { ReadonlyText } from "./utils/text";
import {
  createDateConverter,
  type SupportedDateSchema,
  type DateUnit,
  type DateEncoding,
  type CreateDateConverterParams,
} from "@zodapp/zod-form-react/utils/dateConverter";
import { z } from "zod";

// zf.date でサポートするスキーマ型
type DateSchema = z.ZodDate | z.ZodNumber | z.ZodISODateTime | z.ZodISODate;

const DateComponent = wrapComponent(function DateComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<DateSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { timezone } = useZodFormContext();
  const meta = getMeta(schema) as
    | {
        label?: string;
        unit?: DateUnit;
        encoding?: DateEncoding;
      }
    | undefined;
  const labelFromMeta = meta?.label;
  const unitFromMeta = meta?.unit;
  const encoding = meta?.encoding;
  const label = labelFromParent ?? labelFromMeta;

  // converter 生成（unit/encoding 省略時は自動推論）
  const converter = useMemo(() => {
    // CreateDateConverterParams は Discriminated Union のため、
    // 動的に渡す場合は型アサーションが必要
    return createDateConverter({
      schema: schema as SupportedDateSchema,
      unit: unitFromMeta as DateUnit | undefined,
      encoding: encoding as DateEncoding | undefined,
      timezone,
    } as CreateDateConverterParams);
  }, [schema, unitFromMeta, encoding, timezone]);

  // converter から推論された unit を取得（重複ロジックを排除）
  const unit = converter.unit;

  // Mantine Picker の値（文字列）
  const pickerValue = useMemo(() => {
    return converter.toPickerValue(field.value);
  }, [converter, field.value]);

  const onChange = useCallback(
    (next: string | null) => {
      const value = converter.fromPickerValue(next);
      field.onChange(value);
    },
    [converter, field],
  );

  if (readOnly || field.disabled) {
    return (
      <InputWrapper label={label || undefined} mt={5}>
        <ReadonlyText>{pickerValue ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  // unit に応じた共通 props
  const commonProps = {
    ref,
    value: pickerValue,
    locale: "ja" as const,
    firstDayOfWeek: 0 as const,
    monthLabelFormat: "YYYY年M月",
    defaultDate: new Date(),
    onChange,
    onBlur: field.onBlur,
    onFocus,
    label: label || undefined,
    error: error?.message,
    required: required !== false,
    disabled: readOnly || field.disabled,
    clearable: true,
    mt: 5,
  };

  // unit に応じたコンポーネント選択
  switch (unit) {
    case "year":
      return <YearPickerInput {...commonProps} valueFormat="YYYY" />;
    case "month":
      return <MonthPickerInput {...commonProps} valueFormat="YYYY-MM" />;
    case "day":
      return <DatePickerInput {...commonProps} valueFormat="YYYY-MM-DD" />;
    case "minute":
      return (
        <DateTimePicker
          {...commonProps}
          valueFormat="YYYY-MM-DD HH:mm"
          withSeconds={false}
        />
      );
    case "second":
    case "millisecond":
    default:
      return (
        <DateTimePicker
          {...commonProps}
          valueFormat="YYYY-MM-DD HH:mm:ss"
          withSeconds={true}
        />
      );
  }
});

export { DateComponent as component };
