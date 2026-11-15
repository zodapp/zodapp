import {
  ZodFormProps,
  zfReact as zf,
  getMetaReact,
} from "@zodapp/zod-form-react";
import type { ComputedMetaDef, FnInput } from "@zodapp/zod-form";
import { useTableFnInput } from "@zodapp/zod-form-react/common";
import { renderComputedValue } from "../utils/renderComputedValue";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedRuntimeMeta = ComputedMetaDef<unknown>;

/**
 * テーブル表示用 computed コンポーネント。
 * value はセルの値（defaultValue）、parent は行の値（TableRowProvider）から取り出す。
 */
const ComputedComponent = ({
  schema,
  defaultValue,
  fieldPath,
}: ZodFormProps<ComputedSchema>) => {
  const meta = getMetaReact(schema, "computed") as
    | ComputedRuntimeMeta
    | undefined;
  const input = useTableFnInput(meta, fieldPath, defaultValue);

  const content = meta
    ? (meta.compute as (input: FnInput) => unknown)(input)
    : undefined;

  return <>{renderComputedValue(content)}</>;
};

export { ComputedComponent as component };
