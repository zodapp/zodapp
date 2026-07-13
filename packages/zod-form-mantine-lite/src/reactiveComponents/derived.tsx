import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  useResolverContext,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import type { DerivedMetaDef } from "@zodapp/zod-form";
import { renderComputedFieldValue } from "../utils/renderComputedValue";
import { inputWrapperStyle } from "../utils/styles";

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
 * defaultValue（フィールド自身の値）を compute に渡してレンダリングする。
 * tanstack 非依存。
 */
const DerivedComponent = React.memo(function DerivedComponent({
  schema,
  defaultValue,
  label: labelFromParent,
}: ZodFormProps<DerivedSchema>) {
  const meta = getMetaReact(schema, "derived");
  const { label: labelFromMeta } =
    meta ?? ({} as Partial<DerivedMeta>);
  const label = labelFromParent ?? labelFromMeta;
  const context = useResolverContext(meta?.contextId);

  const content = useMemo(() => {
    return runDerived(meta as DerivedMeta | undefined, defaultValue, context);
  }, [meta, defaultValue, context]);

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

DerivedComponent.displayName = "ReactiveDerivedComponent";

export { DerivedComponent as component };
