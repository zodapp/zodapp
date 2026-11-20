import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import {
  createTimeConverter,
  type SupportedTimeSchema,
  type TimeEncoding,
  type TimeUnit,
} from "@zodapp/zod-form-react/utils/timeConverter";
import { useMemo } from "react";

// 表では数値も HH:mm / HH:mm:ss の形で表示する
const TimeComponent = ({
  schema,
  value,
}: ZodFormProps<SupportedTimeSchema>) => {
  const meta = getMeta(schema) as
    | { unit?: TimeUnit; encoding?: TimeEncoding }
    | undefined;
  const text = useMemo(() => {
    const converter = createTimeConverter({
      schema,
      unit: meta?.unit,
      encoding: meta?.encoding,
    });
    return converter.toPickerValue(value);
  }, [schema, meta?.unit, meta?.encoding, value]);

  return (
    <Text size="sm" c={text ? undefined : "dimmed"}>
      {text ?? "-"}
    </Text>
  );
};

export { TimeComponent as component };
