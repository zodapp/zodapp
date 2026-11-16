import React from "react";
import { Input, Text } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
  useEmptiness,
} from "@zodapp/zod-form-react/common";
import { ZodForm } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = wrapComponent(
  function LiteralComponentImplement({
    schema,
    fieldPath,
    samePath,
    field,
    label: labelFromParent,
    error,
  }: ZodFormInternalProps<LiteralSchema>) {
    const { optional, nullable } = useEmptiness(fieldPath, samePath);
    const { label: labelFromMeta } = getMeta(schema) ?? {};
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
