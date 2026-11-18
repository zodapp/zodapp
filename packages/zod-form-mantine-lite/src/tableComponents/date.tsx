import { useMemo } from "react";
import { Text } from "@mantine/core";
import {
  useZodFormContext,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  createDateConverter,
  type CreateDateConverterParams,
  type DateEncoding,
  type DateUnit,
  type SupportedDateSchema,
} from "@zodapp/zod-form-react/utils/dateConverter";

type DateSchema = SupportedDateSchema;

/**
 * 表の日付のセル。
 * Date・数（timestamp）・ISO の文字列（z.iso.date・z.iso.datetime）のどれも、
 * フォームの欄と同じ converter で読み、ピッカーと同じ unit の形
 * （例：秒までなら YYYY-MM-DD HH:mm:ss、日付だけなら YYYY-MM-DD）で出す
 */
const DateComponent = ({ schema, defaultValue }: ZodFormProps<DateSchema>) => {
  const { timezone } = useZodFormContext();
  const meta = getMeta(schema, "date");
  const unit = meta?.unit as DateUnit | undefined;
  const encoding = meta?.encoding as DateEncoding | undefined;

  const text = useMemo(() => {
    if (defaultValue === undefined || defaultValue === null) return null;
    // 不正な Date は空として出す
    if (defaultValue instanceof Date && Number.isNaN(defaultValue.getTime())) {
      return null;
    }
    try {
      return createDateConverter({
        schema,
        unit,
        encoding,
        timezone,
      } as CreateDateConverterParams).toPickerValue(defaultValue);
    } catch {
      // 日付として扱えないスキーマは、空として出す
      return null;
    }
  }, [schema, unit, encoding, timezone, defaultValue]);

  return (
    <Text size="sm" c={text ? undefined : "dimmed"}>
      {text ?? "-"}
    </Text>
  );
};

export { DateComponent as component };
