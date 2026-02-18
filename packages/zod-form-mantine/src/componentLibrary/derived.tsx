import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { useZodField } from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import { renderComputedValue } from "./utils/renderComputedValue";

type DerivedSchema = ReturnType<typeof zf.derived>;

type DerivedMeta = NonNullable<
  ReturnType<typeof getMetaReact<DerivedSchema, "derived">>
>;

/**
 * 該当フィールドの値を購読してcompute関数で変換した結果を表示するコンポーネント
 * computed と異なり、自身のフィールド値を受け取る（単一フィールドの変換）
 */
const DerivedComponent = React.memo(function DerivedComponent({
  schema,
  label: labelFromParent,
  required,
  fieldPath,
}: ZodFormProps<DerivedSchema>) {
  const meta = getMetaReact(schema, "derived");
  const { label: labelFromMeta, compute } = meta ?? {} as Partial<DerivedMeta>;
  const label = labelFromParent ?? labelFromMeta;

  const fieldApi = useZodField(fieldPath);

  const content = useMemo(() => {
    return compute?.(fieldApi.state.value);
  }, [compute, fieldApi.state.value]);

  return (
    <InputWrapper
      label={label ?? undefined}
      required={required !== false}
      labelElement="div"
      mt={5}
    >
      {renderComputedValue(content)}
    </InputWrapper>
  );
});

export { DerivedComponent as component };
