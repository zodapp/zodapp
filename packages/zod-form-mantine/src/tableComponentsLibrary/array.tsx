import { Badge, Group, Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";

type ArraySchema = z.ZodArray<z.ZodTypeAny>;

const ArrayComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<ArraySchema>) => {
  const items = Array.isArray(defaultValue) ? defaultValue : [];
  const elementSchema = schema.element;

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }

  // 要素が enum の場合は Badge で表示
  if (elementSchema instanceof z.ZodEnum) {
    const { schemas } = getMeta(elementSchema) ?? {};
    return (
      <Group gap="xs">
        {items.map((item, index) => {
          const itemKey = String(item);
          const literalMeta = schemas?.[itemKey]
            ? getMeta(schemas[itemKey])
            : null;
          const label = literalMeta?.label ?? itemKey;
          const color = literalMeta?.color ?? "gray";
          return (
            <Badge key={index} color={color} variant="light">
              {label}
            </Badge>
          );
        })}
      </Group>
    );
  }

  // それ以外はカンマ区切りで表示（デザインは崩れてもOK）
  return <Text size="sm">{items.join(", ")}</Text>;
};

export { ArrayComponent as component };
