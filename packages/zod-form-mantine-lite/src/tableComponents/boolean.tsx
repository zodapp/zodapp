import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";
import { useMsg } from "../messages/useMsg";

type BooleanSchema = z.ZodBoolean;

const BooleanComponent = ({ defaultValue }: ZodFormProps<BooleanSchema>) => {
  const value = typeof defaultValue === "boolean" ? defaultValue : null;
  const msg = useMsg();
  return (
    <Text size="sm" c={value !== null ? undefined : "dimmed"}>
      {value !== null
        ? value
          ? msg("zodFormMantineLite.yes" /* はい */)
          : msg("zodFormMantineLite.no" /* いいえ */)
        : "-"}
    </Text>
  );
};

export { BooleanComponent as component };
