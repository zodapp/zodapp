import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<EnumSchema>) => {
  const { schemas } = getMeta(schema) ?? {};
  const value = defaultValue as string | undefined;

  if (value === undefined || value === null) {
    return null;
  }

  const literalMeta = schemas?.[value] ? getMeta(schemas[value]) : null;
  const label = literalMeta?.label ?? value;
  const color = literalMeta?.color ?? "gray";

  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
};

export { EnumComponent as component };
