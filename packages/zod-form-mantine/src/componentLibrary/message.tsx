import React from "react";
import { Text, InputWrapper } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";

type MessageSchema = ReturnType<typeof zf.message>;

const MessageComponent = wrapComponent(function MessageComponentImplement({
  schema,
  label: labelFromParent,
  required,
  error,
}: ZodFormInternalProps<MessageSchema>) {
  const meta = getMetaReact(schema, "message"); // schemaはneverだが、messageのregistryを取得できる
  const { label: labelFromMeta, content } = meta ?? {};
  const label = labelFromParent ?? labelFromMeta;
  return (
    <InputWrapper
      label={label ?? undefined}
      required={required !== false}
      error={error?.message}
      labelElement="div" // disable auto biding of label to input
      mt={5}
    >
      <Text p="sm">{content}</Text>
    </InputWrapper>
  );
});

export { MessageComponent as component };
