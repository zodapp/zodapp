import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { renderComputedValue } from "../utils/renderComputedValue";

type StringSchema = z.ZodString;

const StringComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<StringSchema>) => {
  const { formatter } = getMeta(schema, "string") ?? {};
  const raw = typeof defaultValue === "string" ? defaultValue : null;

  if (raw && formatter) {
    return <>{renderComputedValue(formatter(raw), "table")}</>;
  }

  return (
    <Text size="sm" c={raw ? undefined : "dimmed"} lineClamp={1}>
      {raw ?? "-"}
    </Text>
  );
};

export { StringComponent as component };
