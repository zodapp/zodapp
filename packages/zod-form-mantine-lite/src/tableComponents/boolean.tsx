import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";
import { useMsg } from "../messages/useMsg";

type BooleanSchema = z.ZodBoolean;

const BooleanComponent = ({
  value: valueProp,
}: ZodFormProps<BooleanSchema>) => {
  const value = typeof valueProp === "boolean" ? valueProp : null;
  const msg = useMsg();
  return (
    <Text size="sm" c={value !== null ? undefined : "dimmed"}>
      {value !== null
        ? value
          ? msg("zodFormMantineLite.yes" /* i18n: はい */)
          : msg("zodFormMantineLite.no" /* i18n: いいえ */)
        : "-"}
    </Text>
  );
};

export { BooleanComponent as component };
