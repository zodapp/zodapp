import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { renderComputedValue } from "../utils/renderComputedValue";

type NumberSchema = z.ZodNumber;

const NumberComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<NumberSchema>) => {
  const { formatter } = getMeta(schema, "number") ?? {};
  const value = typeof defaultValue === "number" ? defaultValue : null;

  if (value !== null && formatter) {
    return <>{renderComputedValue(formatter(value), "table")}</>;
  }

  return (
    <Text size="sm" c={value !== null ? undefined : "dimmed"}>
      {value !== null ? String(value) : "-"}
    </Text>
  );
};

export { NumberComponent as component };
