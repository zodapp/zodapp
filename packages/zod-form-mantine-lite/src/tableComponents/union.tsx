import { Text } from "@mantine/core";
import { Switch, type ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type UnionSchema = z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const EmptyValue = () => (
  <Text size="sm" c="dimmed">
    -
  </Text>
);

const UnionComponent = ({
  schema,
  value,
  ...props
}: ZodFormProps<UnionSchema>) => {
  const options = schema.options as readonly z.ZodTypeAny[];
  const matchedSchema = options.find(
    (option) => option.safeParse(value).success,
  );

  if (!matchedSchema) {
    return <EmptyValue />;
  }

  return <Switch {...props} schema={matchedSchema} value={value} />;
};

export { UnionComponent as component };
