import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import type { ComputedMetaDef, FnInput } from "@zodapp/zod-form";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { useFnInput, useResolveText } from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import {
  renderComputedFieldValue,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedRuntimeMeta = ComputedMetaDef<unknown>;

/**
 * compute 関数に { value, parent, context } を渡し、結果を表示するコンポーネント。
 * 何を購読するかは meta の dependsOnValue / dependsOnParent / contextId で決まる。
 */
const ComputedComponent = React.memo(function ComputedComponent({
  schema,
  label: labelFromParent,
  fieldPath,
}: ZodFormProps<ComputedSchema>) {
  const meta = getMetaReact(schema, "computed") as
    | ComputedRuntimeMeta
    | undefined;
  const resolveText = useResolveText();
  // meta の label は msgKey で書いたキーのことがある。表示する前に訳す
  const label = labelFromParent ?? resolveText(meta?.label);
  const input = useFnInput(meta, fieldPath);

  const content = useMemo(
    () =>
      meta ? (meta.compute as (input: FnInput) => unknown)(input) : undefined,
    [meta, input],
  );

  return (
    <InputWrapper
      label={label || undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      {renderComputedFieldValue(content)}
    </InputWrapper>
  );
});

export { ComputedComponent as component };
