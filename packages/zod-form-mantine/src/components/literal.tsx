import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { Input, Text } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { ZodForm } from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = wrapComponent(
  function LiteralComponentImplement({
    schema,
    field,
    label: labelFromParent,
    outer,
    error,
  }: ZodFormInternalProps<LiteralSchema>) {
    const { optional, nullable } = emptinessOf(outer);
    const { label: labelFromMeta } = useResolvedMeta(schema) ?? {};
    const label = labelFromParent ?? labelFromMeta;

    const displayValue = field.value;

    return (
      <Input.Wrapper
        label={label ?? undefined}
        error={error?.message}
        required={!(optional || nullable)}
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
