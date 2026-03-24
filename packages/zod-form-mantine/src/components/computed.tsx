import React, { useMemo } from "react";
import { InputWrapper } from "@mantine/core";
import type { ComputedMetaDef } from "@zodapp/zod-form";
import { ZodFormProps } from "@zodapp/zod-form-react";
import {
  useFormValues,
  useZodField,
  useResolverContext,
} from "@zodapp/zod-form-react/common";
import { zfReact as zf, getMetaReact } from "@zodapp/zod-form-react";
import {
  renderComputedValue,
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedRuntimeMeta = ComputedMetaDef<unknown>;

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
  meta: ComputedRuntimeMeta | undefined;
};

type ComputedDisplayProps = {
  label: string | undefined;
  required: boolean;
  content: unknown;
};

const runComputed = (
  meta: ComputedRuntimeMeta | undefined,
  parent: unknown,
  context: unknown,
) => {
  if (!meta) {
    return undefined;
  }
  if (meta.contextId === undefined) {
    return meta.compute(parent);
  }
  if (context === undefined) {
    throw new Error(`resolverContext["${meta.contextId}"] is required for computed`);
  }
  return meta.compute(parent, context as Parameters<typeof meta.compute>[1]);
};

/**
 * 計算結果を表示するコンポーネント
 */
const ComputedDisplay = React.memo(function ComputedDisplay({
  label,
  content,
}: ComputedDisplayProps) {
  return (
    <InputWrapper
      label={label ?? undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      {typeof content === "string" ? (
        <ReadonlyText>{content}</ReadonlyText>
      ) : (
        renderComputedValue(content)
      )}
    </InputWrapper>
  );
});

/**
 * ルートの場合: フォーム全体を購読
 */
const ComputedRoot = React.memo(function ComputedRoot({
  label,
  required,
  meta,
}: ComputedInnerProps) {
  const formValues = useFormValues();
  const context = useResolverContext(meta?.contextId);

  const content = useMemo(() => {
    return runComputed(meta, formValues, context);
  }, [meta, formValues, context]);

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
  meta,
  parentPath,
}: ComputedInnerProps & { parentPath: string }) {
  const parentFieldApi = useZodField(parentPath);
  const context = useResolverContext(meta?.contextId);

  const content = useMemo(() => {
    return runComputed(meta, parentFieldApi.state.value, context);
  }, [meta, parentFieldApi.state.value, context]);

  return (
    <ComputedDisplay label={label} required={required} content={content} />
  );
});

/**
 * 親オブジェクトを購読してcompute関数で計算した結果を表示するコンポーネント
 * parentPathに応じてルート用/ネスト用のコンポーネントに分岐
 */
const ComputedComponent = React.memo(function ComputedComponent({
  schema,
  label: labelFromParent,
  required,
  fieldPath,
}: ZodFormProps<ComputedSchema>) {
  const meta = getMetaReact(schema, "computed") as ComputedRuntimeMeta | undefined;
  const { label: labelFromMeta } = meta ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const parentPath = getParentPath(fieldPath);

  const innerProps: ComputedInnerProps = {
    label: label || undefined,
    required: required !== false,
    meta,
  };

  if (parentPath === "") {
    return <ComputedRoot {...innerProps} />;
  }

  return <ComputedNested {...innerProps} parentPath={parentPath} />;
});

export { ComputedComponent as component };
