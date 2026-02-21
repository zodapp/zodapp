import React from "react";
import { Input, Text } from "@mantine/core";
import type { ZodFormProps, ZodForm } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = React.memo(function LiteralComponent({
  schema,
  defaultValue,
  label: labelFromParent,
  required,
}: ZodFormProps<LiteralSchema>) {
  const { label: labelFromMeta } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;

  return (
    <Input.Wrapper
      label={label ?? undefined}
      required={required !== false}
      mt={5}
    >
      <Text size="sm" c="dimmed">
        {String(defaultValue)}
      </Text>
    </Input.Wrapper>
  );
});

LiteralComponent.displayName = "ReactiveLiteralComponent";

export { LiteralComponent as component };
