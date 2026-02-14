import { Text } from "@mantine/core";
import { ZodFormProps, zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";

type ComputedSchema = ReturnType<typeof zf.computed>;

const ComputedComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<ComputedSchema>) => {
  const meta = getMetaReact(schema, "computed");
  const { compute } = meta ?? {};

  const content = compute?.(defaultValue);

  return <Text size="sm">{content}</Text>;
};

export { ComputedComponent as component };
