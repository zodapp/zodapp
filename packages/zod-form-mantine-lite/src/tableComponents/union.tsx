import { Text } from "@mantine/core";
import { Dynamic, type ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type UnionSchema = z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const EmptyValue = () => (
  <Text size="sm" c="dimmed">
    -
  </Text>
);

const UnionComponent = ({
  schema,
  defaultValue,
  ...props
}: ZodFormProps<UnionSchema>) => {
  const options = schema.options as readonly z.ZodTypeAny[];
  const matchedSchema = options.find(
    (option) => option.safeParse(defaultValue).success,
  );

  if (!matchedSchema) {
    return <EmptyValue />;
  }

  return <Dynamic {...props} schema={matchedSchema} defaultValue={defaultValue} />;
};

export { UnionComponent as component };
