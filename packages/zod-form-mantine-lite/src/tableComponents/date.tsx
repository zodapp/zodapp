import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type DateSchema = z.ZodDate;

const DateComponent = ({ defaultValue }: ZodFormProps<DateSchema>) => {
  const value = defaultValue instanceof Date ? defaultValue : null;
  return (
    <Text size="sm" c={value ? undefined : "dimmed"}>
      {value?.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) ?? "-"}
    </Text>
  );
};

export { DateComponent as component };
