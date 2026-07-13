import { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  ZodFormInternalProps,
  useResolverContext,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import type { DerivedMetaDef } from "@zodapp/zod-form";
import {
  renderComputedFieldValue,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type DerivedSchema = ReturnType<typeof zf.derived>;

type DerivedMeta = DerivedMetaDef<unknown>;

const runDerived = (
  meta: DerivedMeta | undefined,
  value: unknown,
  context: unknown,
) => {
  if (!meta) {
    return undefined;
  }
  if (meta.contextId === undefined) {
    return meta.compute(value);
  }
  if (context === undefined) {
    throw new Error(`resolverContext["${meta.contextId}"] is required for derived`);
  }
  return (meta.compute as (fieldValue: unknown, resolverContext: unknown) => unknown)(
    value,
    context,
  );
};

/**
 * 該当フィールドの値を購読してcompute関数で変換した結果を表示するコンポーネント
 * computed と異なり、自身のフィールド値を受け取る（単一フィールドの変換）
 */
const DerivedComponent = wrapComponent(function DerivedComponentImplement({
  schema,
  label: labelFromParent,
  field,
}: ZodFormInternalProps<DerivedSchema>) {
  const meta = getMetaReact(schema, "derived");
  const { label: labelFromMeta } =
    meta ?? ({} as Partial<DerivedMeta>);
  const label = labelFromParent ?? labelFromMeta;
  const context = useResolverContext(meta?.contextId);

  const content = useMemo(() => {
    return runDerived(meta as DerivedMeta | undefined, field.value, context);
  }, [meta, field.value, context]);

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

export { DerivedComponent as component };
