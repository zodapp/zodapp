import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { useFormValues, useZodField } from "@zodapp/zod-form-react/common";
import { ReadonlyText } from "./utils/text";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedMeta = NonNullable<
  ReturnType<typeof getMetaReact<ComputedSchema, "computed">>
>;

/**
 * fieldPathから親のパスを取得する
 * 例: "parent.child" -> "parent", "items[0].name" -> "items[0]"
 */
const getParentPath = (fieldPath: string): string => {
  const lastDotIndex = fieldPath.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return ""; // ルートの場合は空文字列
  }
  return fieldPath.slice(0, lastDotIndex);
};

type ComputedInnerProps = {
  label: string | undefined;
  required: boolean;
  compute: ComputedMeta["compute"] | undefined;
};

type ComputedDisplayProps = {
  label: string | undefined;
  required: boolean;
  content: React.ReactNode;
};

/**
 * 計算結果を表示するコンポーネント
 */
const ComputedDisplay = React.memo(function ComputedDisplay({
  label,
  required,
  content,
}: ComputedDisplayProps) {
  return (
    <InputWrapper
      label={label ?? undefined}
      required={required}
      labelElement="div"
      mt={5}
    >
      <ReadonlyText>{content}</ReadonlyText>
    </InputWrapper>
  );
});

/**
 * ルートの場合: フォーム全体を購読
 */
const ComputedRoot = React.memo(function ComputedRoot({
  label,
  required,
  compute,
}: ComputedInnerProps) {
  const formValues = useFormValues();

  const content = useMemo(() => {
    return compute?.(formValues);
  }, [compute, formValues]);

  return (
    <ComputedDisplay label={label} required={required} content={content} />
  );
});

/**
 * ネストされた場合: 親フィールドを購読
 */
const ComputedNested = React.memo(function ComputedNested({
  label,
  required,
  compute,
  parentPath,
}: ComputedInnerProps & { parentPath: string }) {
  const parentFieldApi = useZodField(parentPath);

  const content = useMemo(() => {
    return compute?.(parentFieldApi.state.value);
  }, [compute, parentFieldApi.state.value]);

  return (
    <ComputedDisplay label={label} required={required} content={content} />
  );
});

/**
 * 1階層上のfieldPathを購読してcompute関数で計算した結果を表示するコンポーネント
 * parentPathに応じてルート用/ネスト用のコンポーネントに分岐
 */
const ComputedComponent = React.memo(function ComputedComponent({
  schema,
  label: labelFromParent,
  required,
  fieldPath,
}: ZodFormProps<ComputedSchema>) {
  const meta = getMetaReact(schema, "computed");
  const { label: labelFromMeta, compute } = meta ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const parentPath = getParentPath(fieldPath);

  const innerProps: ComputedInnerProps = {
    label: label || undefined,
    required: required !== false,
    compute,
  };

  if (parentPath === "") {
    return <ComputedRoot {...innerProps} />;
  }

  return <ComputedNested {...innerProps} parentPath={parentPath} />;
});

export { ComputedComponent as component };
