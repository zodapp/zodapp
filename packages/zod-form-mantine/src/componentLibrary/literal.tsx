import React from "react";
import { Input, Text } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { ZodForm } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "./utils/styles";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = wrapComponent(
  function LiteralComponentImplement({
    schema,
    field,
    label: labelFromParent,
    required,
    error,
  }: ZodFormInternalProps<LiteralSchema>) {
    const { label: labelFromMeta } = getMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;

    const displayValue = field.value;

    return (
      <Input.Wrapper
        label={label ?? undefined}
        error={error?.message}
        required={required !== false}
        style={inputWrapperStyle}
      >
        <Text size="sm" c="dimmed">
          {String(displayValue)}
        </Text>
      </Input.Wrapper>
    );
  },
);

export { LiteralComponent as component };
