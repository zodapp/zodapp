import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";
import { useSchemaValueAction } from "@zodapp/zod-form-react/common";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = ({ schema, defaultValue }: ZodFormProps<EnumSchema>) => {
  const { schemas } = getMeta(schema) ?? {};
  const value = defaultValue as string | number | undefined;
  const actionWrapper = useSchemaValueAction(
    schema,
    value === undefined || value === null ? null : String(value),
    false,
  );

  if (value === undefined || value === null) {
    return null;
  }

  const key = String(value);
  const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
  const label = literalMeta?.label ?? key;
  const color = literalMeta?.color ?? "gray";

  const content = (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
  return actionWrapper ? <>{actionWrapper(content)}</> : content;
};

export { EnumComponent as component };
