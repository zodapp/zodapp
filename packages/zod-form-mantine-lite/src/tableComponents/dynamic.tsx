import { Suspense } from "react";
import { Loader, Text } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import {
  Switch,
  useResolvedSchema,
  useTableFnInput,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import type z from "zod";
import { useMsg } from "../messages/useMsg";

/**
 * テーブル表示用 dynamic コンポーネント。
 * resolve({ value: セルの値, parent: 行の中の親, context }) を呼び、
 * 結果の schema を表用の部品で描画する。表は読み取り専用なので、prune も検証もしない。
 * 子の部品を読み込むあいだは、このセルだけを読み込み中にする。
 */
const DynamicComponent = (props: ZodFormProps<z.ZodTypeAny>) => {
  const { schema, fieldPath, defaultValue } = props;
  const meta = getMeta(schema, "dynamic");
  const input = useTableFnInput(meta, fieldPath, defaultValue);
  const state = useResolvedSchema(meta, input);
  const msg = useMsg();

  if (state.status === "loading" || state.status === "pending") {
    return <Loader size="xs" />;
  }
  if (state.status === "error") {
    return (
      <Text size="sm" c="dimmed">
        {msg("zodFormMantineLite.fetchFailed" /* i18n: 取得できませんでした */)}
      </Text>
    );
  }
  return (
    <Suspense fallback={<Loader size="xs" />}>
      <Switch {...props} schema={state.schema} />
    </Suspense>
  );
};

export { DynamicComponent as component };
