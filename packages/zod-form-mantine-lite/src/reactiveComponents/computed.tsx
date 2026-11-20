import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  useTableFnInput,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import type { ComputedMetaDef, FnInput } from "@zodapp/zod-form";
import { renderComputedFieldValue } from "../utils/renderComputedValue";
import { inputWrapperStyle } from "../utils/styles";
import { useResolveText } from "@zodapp/zod-form-react/common";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedMeta = ComputedMetaDef<unknown>;

/**
 * compute 関数に { value, parent, context } を渡してレンダリングする。
 * value は props の value（フィールド自身の値）、parent は TableRowProvider の値から取り出す。
 * tanstack 非依存。
 */
const ComputedComponent = React.memo(function ComputedComponent({
  schema,
  value,
  fieldPath,
  label: labelFromParent,
}: ZodFormProps<ComputedSchema>) {
  const meta = getMetaReact(schema, "computed") as ComputedMeta | undefined;
  const resolveText = useResolveText();
  const label = labelFromParent ?? resolveText(meta?.label);
  const input = useTableFnInput(meta, fieldPath, value);

  const content = useMemo(
    () =>
      meta ? (meta.compute as (input: FnInput) => unknown)(input) : undefined,
    [meta, input],
  );

  return (
    <InputWrapper
      label={label ?? undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      {renderComputedFieldValue(content)}
    </InputWrapper>
  );
});

ComputedComponent.displayName = "ReactiveComputedComponent";

export { ComputedComponent as component };
