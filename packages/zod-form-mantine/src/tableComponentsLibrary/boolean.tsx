import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type BooleanSchema = z.ZodBoolean;

const BooleanComponent = ({ defaultValue }: ZodFormProps<BooleanSchema>) => {
  const value = typeof defaultValue === "boolean" ? defaultValue : null;
  return (
    <Text size="sm" c={value !== null ? undefined : "dimmed"}>
      {value !== null ? (value ? "はい" : "いいえ") : "-"}
    </Text>
  );
};

export { BooleanComponent as component };
