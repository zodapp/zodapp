import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { useResolveText } from "@zodapp/zod-form-react/common";

type LiteralValue = string | number | bigint | boolean | null | undefined;
type LiteralSchema = z.ZodLiteral<LiteralValue>;

const LiteralComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<LiteralSchema>) => {
  const meta = getMeta(schema, "literal");
  const resolveText = useResolveText();
  const value = defaultValue as LiteralValue | undefined;

  if (value === undefined || value === null) {
    return null;
  }

  const label = resolveText(meta?.label) ?? String(value);
  const color = meta?.color ?? "gray";

  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
};

export { LiteralComponent as component };
