import React from "react";
import { Input, Text } from "@mantine/core";
import {
  useEmptiness,
  type ZodFormProps,
  type ZodForm,
} from "@zodapp/zod-form-react/common";
import { zf, getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "../utils/styles";

type LiteralSchema = ReturnType<typeof zf.literal>;

const LiteralComponent: ZodForm<LiteralSchema> = React.memo(
  function LiteralComponent({
    schema,
    fieldPath,
    defaultValue,
    label: labelFromParent,
  }: ZodFormProps<LiteralSchema>) {
    const { optional, nullable } = useEmptiness(fieldPath);
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
