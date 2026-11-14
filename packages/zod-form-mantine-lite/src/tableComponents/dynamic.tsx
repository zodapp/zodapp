import { Loader, Text } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import {
  Switch,
  useResolvedSchema,
  useTableFnInput,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import type z from "zod";

/**
 * テーブル表示用 dynamic コンポーネント。
 * resolve({ value: セルの値, parent: 行の中の親, context }) を呼び、
 * 結果の schema を表用の部品で描画する。表は読み取り専用なので、prune も検証もしない。
 */
const DynamicComponent = (props: ZodFormProps<z.ZodTypeAny>) => {
  const { schema, fieldPath, defaultValue } = props;
  const meta = getMeta(schema, "dynamic");
  const input = useTableFnInput(meta, fieldPath, defaultValue);
  const state = useResolvedSchema(meta, input);

  if (state.status === "loading" || state.status === "pending") {
    return <Loader size="xs" />;
  }
  if (state.status === "error") {
    return (
      <Text size="sm" c="dimmed">
        取得できませんでした
      </Text>
    );
  }
  return <Switch {...props} schema={state.schema} />;
};

export { DynamicComponent as component };
