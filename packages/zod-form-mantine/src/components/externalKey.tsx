import React, { Suspense } from "react";
import { Loader, Select } from "@mantine/core";
import {
  Switch,
  DynamicDepthProvider,
  useDynamicDepth,
  useDynamicSchema,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { useExternalKeyDynamicMeta } from "@zodapp/zod-form-react/utils/externalKey";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import type z from "zod";
import { DynamicErrorView } from "./dynamic";

type ExternalKeySchema = z.ZodString;

/**
 * externalKey。dynamic にラッパーをかぶせて作る。
 *
 * ラッパーは config から resolver を引き、選択肢を schema（既定は enum、
 * allowUnlisted なら string + 選択式）にするだけ。検証・取り直し中・prune は dynamic と同じ。
 */
const ExternalKeyComponent = React.memo(function ExternalKeyComponent(
  props: ZodFormProps<ExternalKeySchema>,
) {
  const {
    fieldPath,
    schema,
    optional,
    nullable,
    label: labelFromParent,
  } = props;
  const meta = getMeta(schema, "externalKey");
  const label = labelFromParent ?? meta?.label;
  const dynamicMeta = useExternalKeyDynamicMeta(schema);
  const depth = useDynamicDepth(fieldPath);
  const state = useDynamicSchema(dynamicMeta, fieldPath, {
    optional,
    nullable,
    schema,
  });

  const loadingView = (status?: "loading" | "pending") => (
    <Select
      value={null}
      data={[]}
      label={label || undefined}
      required={!(optional || nullable)}
      disabled={true}
      rightSection={<Loader size="xs" />}
      placeholder="読み込み中"
      style={inputWrapperStyle}
      data-dynamic-status={status}
    />
  );

  if (state.status === "loading" || state.status === "pending") {
    return loadingView(state.status);
  }

  if (state.status === "error") {
    return <DynamicErrorView label={label || undefined} retry={state.retry} />;
  }

  // 子の部品を読み込むあいだは、この欄だけを読み込み中にする
  return (
    <Suspense fallback={loadingView()}>
      <DynamicDepthProvider path={fieldPath} depth={depth}>
        <Switch {...props} schema={state.schema} />
      </DynamicDepthProvider>
    </Suspense>
  );
});

export { ExternalKeyComponent as component };
