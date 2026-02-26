import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import { renderComputedValue } from "../utils/renderComputedValue";
import { inputWrapperStyle } from "../utils/styles";

type DerivedSchema = ReturnType<typeof zf.derived>;

type DerivedMeta = NonNullable<
  ReturnType<typeof getMetaReact<DerivedSchema, "derived">>
>;

/**
 * defaultValue（フィールド自身の値）を compute に渡してレンダリングする。
 * tanstack 非依存。
 */
const DerivedComponent = React.memo(function DerivedComponent({
  schema,
  defaultValue,
  label: labelFromParent,
  required,
}: ZodFormProps<DerivedSchema>) {
  const meta = getMetaReact(schema, "derived");
  const { label: labelFromMeta, compute } =
    meta ?? ({} as Partial<DerivedMeta>);
  const label = labelFromParent ?? labelFromMeta;

  const content = useMemo(() => {
    return compute?.(defaultValue);
  }, [compute, defaultValue]);

  return (
    <InputWrapper
      label={label ?? undefined}
      required={required !== false}
      labelElement="div"
      style={inputWrapperStyle}
    >
      {renderComputedValue(content)}
    </InputWrapper>
  );
});

DerivedComponent.displayName = "ReactiveDerivedComponent";

export { DerivedComponent as component };
