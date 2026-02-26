import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type NumberSchema = z.ZodNumber;

const NumberComponent = ({ defaultValue }: ZodFormProps<NumberSchema>) => {
  const value = typeof defaultValue === "number" ? defaultValue : null;
  return (
    <Text size="sm" c={value !== null ? undefined : "dimmed"}>
      {value !== null ? String(value) : "-"}
    </Text>
  );
};

export { NumberComponent as component };
