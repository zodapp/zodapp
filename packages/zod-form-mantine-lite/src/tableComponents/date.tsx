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

const formatDate = (value: Date) =>
  value.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/**
 * 表の日付のセル。
 * Date はこれまでどおり日時で出す。数（timestamp）や ISO の文字列（z.iso.date・z.iso.datetime）は、
 * フォームの欄と同じ converter で読み、unit の形（例：日付だけなら YYYY-MM-DD）で出す
 */
const DateComponent = ({ schema, defaultValue }: ZodFormProps<DateSchema>) => {
  const { timezone } = useZodFormContext();
  const meta = getMeta(schema, "date");
  const unit = meta?.unit as DateUnit | undefined;
  const encoding = meta?.encoding as DateEncoding | undefined;

  const text = useMemo(() => {
    if (defaultValue instanceof Date) {
      return Number.isNaN(defaultValue.getTime())
        ? null
        : formatDate(defaultValue);
    }
    if (defaultValue === undefined || defaultValue === null) return null;
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
