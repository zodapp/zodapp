import React from "react";
import { Input, Text } from "@mantine/core";
import type { ZodFormProps, ZodForm } from "@zodapp/zod-form-react/common";
import { emptinessOf } from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "../utils/styles";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = React.memo(
  function LiteralComponent({
    schema,
    defaultValue,
    label: labelFromParent,
    outer,
  }: ZodFormProps<LiteralSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const { label: labelFromMeta } = getMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;

    return (
      <Input.Wrapper
        label={label ?? undefined}
        required={!(optional || nullable)}
        style={inputWrapperStyle}
      >
        <Text size="sm" c="dimmed">
          {String(defaultValue)}
        </Text>
      </Input.Wrapper>
    );
  },
);

LiteralComponent.displayName = "ReactiveLiteralComponent";

export { LiteralComponent as component };
