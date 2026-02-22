import { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import { renderComputedValue } from "./utils/renderComputedValue";
import { inputWrapperStyle } from "./utils/styles";

type DerivedSchema = ReturnType<typeof zf.derived>;

type DerivedMeta = NonNullable<
  ReturnType<typeof getMetaReact<DerivedSchema, "derived">>
>;

/**
 * 該当フィールドの値を購読してcompute関数で変換した結果を表示するコンポーネント
 * computed と異なり、自身のフィールド値を受け取る（単一フィールドの変換）
 */
const DerivedComponent = wrapComponent(function DerivedComponentImplement({
  schema,
  label: labelFromParent,
  required,
  field,
}: ZodFormInternalProps<DerivedSchema>) {
  const meta = getMetaReact(schema, "derived");
  const { label: labelFromMeta, compute } =
    meta ?? ({} as Partial<DerivedMeta>);
  const label = labelFromParent ?? labelFromMeta;

  const content = useMemo(() => {
    return compute?.(field.value);
  }, [compute, field.value]);

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

export { DerivedComponent as component };
