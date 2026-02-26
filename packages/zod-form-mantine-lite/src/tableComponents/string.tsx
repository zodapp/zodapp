import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type StringSchema = z.ZodString;

const StringComponent = ({ defaultValue }: ZodFormProps<StringSchema>) => {
  const value = typeof defaultValue === "string" ? defaultValue : null;
  return (
    <Text size="sm" c={value ? undefined : "dimmed"} lineClamp={1}>
      {value ?? "-"}
    </Text>
  );
};

export { StringComponent as component };
