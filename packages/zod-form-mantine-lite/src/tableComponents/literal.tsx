import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";

type LiteralSchema = z.ZodLiteral<z.Primitive>;

const LiteralComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<LiteralSchema>) => {
  const meta = getMeta(schema, "literal");
  const value = defaultValue as z.Primitive | undefined;

  if (value === undefined || value === null) {
    return null;
  }

  const label = meta?.label ?? String(value);
  const color = meta?.color ?? "gray";

  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
};

export { LiteralComponent as component };
