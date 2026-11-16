import React, { Suspense } from "react";
import { Loader, MultiSelect } from "@mantine/core";
import {
  Switch,
  DynamicDepthProvider,
  useDynamicDepth,
  useDynamicSchema,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  useArrayExternalKeyDynamicMeta,
  type ArrayOfExternalKeySchema,
} from "@zodapp/zod-form-react/utils/externalKey";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { DynamicErrorView } from "./dynamic";

/**
 * 複数選択の externalKey（`z.array(zf.externalKey ...)` に `uiType: "multipleExternalKey"`）。
 * 単一選択の externalKey と同じく、dynamic にラッパーをかぶせて作る。
 *
 * ラッパーは config から resolver を引き、選択肢を schema（既定は enum の配列、
 * allowUnlisted なら string + 選択式の配列）にするだけ。描くのは複数選択の enum の部品で、
 * 検証・取り直し中・取得の失敗（送信を止める）・prune は dynamic と同じ。
 */
const ArrayOfExternalKeyComponent = React.memo(
  function ArrayOfExternalKeyComponent(
    props: ZodFormProps<ArrayOfExternalKeySchema>,
  ) {
    const {
      fieldPath,
      schema,
      optional,
      nullable,
      label: labelFromParent,
    } = props;
    const label = labelFromParent ?? getMeta(schema)?.label;
    const dynamicMeta = useArrayExternalKeyDynamicMeta(schema);
    const depth = useDynamicDepth(fieldPath);
    const state = useDynamicSchema(dynamicMeta, fieldPath, {
      optional: optional || nullable,
    });

    const loadingView = (status?: "loading" | "pending") => (
      <MultiSelect
        value={[]}
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
      return (
        <DynamicErrorView label={label || undefined} retry={state.retry} />
      );
    }

    // 子の部品を読み込むあいだは、この欄だけを読み込み中にする
    return (
      <Suspense fallback={loadingView()}>
        <DynamicDepthProvider path={fieldPath} depth={depth}>
          <Switch {...props} schema={state.schema} />
        </DynamicDepthProvider>
      </Suspense>
    );
  },
);

export { ArrayOfExternalKeyComponent as component };
