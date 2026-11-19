import React from "react";
import type { ZodForm } from "@zodapp/zod-form-react";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zf } from "@zodapp/zod-form";
import { FixedValueComponent } from "../utils/fixedValue";
import { component as EnumComponent } from "./enum";

type LiteralSchema = ReturnType<typeof zf.literal>;

/**
 * `z.literal()` の入口（`literal_select`・`literal_badge` も受ける）。
 * - 値が 1 つ：固定値の部品（既定で出さず、値が無ければ書き込む。{@link FixedValueComponent}）
 * - 値が 2 つ以上（`z.literal(["a", "b"])`）：enum と同じ部品で選ぶ
 */
const LiteralComponent: ZodForm<LiteralSchema> = (
  props: ZodFormProps<LiteralSchema>,
) => {
  const values = (props.schema.def as { values?: unknown[] }).values ?? [];
  if (values.length > 1) {
    return (
      <EnumComponent
        {...(props as unknown as React.ComponentProps<typeof EnumComponent>)}
      />
    );
  }
  return <FixedValueComponent {...(props as unknown as ZodFormProps)} />;
};

export { LiteralComponent as component };
