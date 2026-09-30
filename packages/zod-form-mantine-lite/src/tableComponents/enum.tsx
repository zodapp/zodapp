import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = ({ schema, defaultValue }: ZodFormProps<EnumSchema>) => {
  const { schemas } = getMeta(schema) ?? {};
  const value = defaultValue as string | number | undefined;

  if (value === undefined || value === null) {
    return null;
  }

  const key = String(value);
  const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
  const label = literalMeta?.label ?? key;
  const color = literalMeta?.color ?? "gray";

  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
};

export { EnumComponent as component };
