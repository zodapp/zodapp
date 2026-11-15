import React, { Suspense } from "react";
import z from "zod";
import { Alert, Button, Group, Loader, Text } from "@mantine/core";
import {
  Switch,
  DynamicDepthProvider,
  useDynamicDepth,
  useDynamicSchema,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";

type DynamicSchema = z.ZodTypeAny;

/** 取得に失敗したときの表示。再試行のボタンを出す */
export const DynamicErrorView = ({
  label,
  retry,
}: {
  label: string | undefined;
  retry: () => void;
}) => (
  <Alert color="red" data-dynamic-status="error">
    <Group justify="space-between">
      <Text size="sm">{label ? `${label}を` : ""}取得できませんでした</Text>
      <Button size="xs" variant="light" onClick={retry}>
        再試行
      </Button>
    </Group>
  </Alert>
);

/** 読み込み中の表示 */
const DynamicLoadingView = ({ status }: { status?: "loading" | "pending" }) => (
  <Group gap="xs" data-dynamic-status={status}>
    <Loader size="xs" />
    <Text size="sm" c="dimmed">
      読み込み中
    </Text>
  </Group>
);

/**
 * 実行時に決まる schema で描画する部品。
 *
 * - 最初の resolve が終わるまでと取り直し中は、読み込み中の表示にする（選べない）
 * - 取得に失敗したら、再試行のボタンを出す
 * - 子に React の key を付けない。返す schema が変わっても、同じ型の部品は作り直さない
 * - 子の部品を読み込むあいだは、この欄だけを読み込み中にする（フォーム全体を止めない）
 */
const DynamicComponent = React.memo(function DynamicComponent(
  props: ZodFormProps<DynamicSchema>,
) {
  const { fieldPath, schema } = props;
  const meta = getMeta(schema, "dynamic");
  const depth = useDynamicDepth(fieldPath);
  const state = useDynamicSchema(meta, fieldPath, {
    required: props.required,
  });

  if (state.status === "loading" || state.status === "pending") {
    return <DynamicLoadingView status={state.status} />;
  }

  if (state.status === "error") {
    return <DynamicErrorView label={meta?.label} retry={state.retry} />;
  }

  return (
    <Suspense fallback={<DynamicLoadingView />}>
      <DynamicDepthProvider path={fieldPath} depth={depth}>
        <Switch {...props} schema={state.schema} />
      </DynamicDepthProvider>
    </Suspense>
  );
});

export { DynamicComponent as component };
