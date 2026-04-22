import { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import {
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import {
  renderComputedFieldValue,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

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
      labelElement="div"
      style={inputWrapperStyle}
    >
      {renderComputedFieldValue(content)}
    </InputWrapper>
  );
});

export { DerivedComponent as component };
