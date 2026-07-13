import {
  ZodFormProps,
  zfReact as zf,
  getMetaReact,
} from "@zodapp/zod-form-react";
import type { DerivedMetaDef } from "@zodapp/zod-form";
import { useResolverContext } from "@zodapp/zod-form-react/common";
import { renderComputedValue } from "../utils/renderComputedValue";

type DerivedSchema = ReturnType<typeof zf.derived>;
type DerivedRuntimeMeta = DerivedMetaDef<unknown>;

const runDerived = (
  meta: DerivedRuntimeMeta | undefined,
  value: unknown,
  context: unknown,
) => {
  if (!meta) {
    return undefined;
  }
  if (meta.contextId === undefined) {
    return meta.compute(value);
  }
  if (context === undefined) {
    throw new Error(`resolverContext["${meta.contextId}"] is required for derived`);
  }
  return (meta.compute as (fieldValue: unknown, resolverContext: unknown) => unknown)(
    value,
    context,
  );
};

/**
 * テーブル表示用 derived コンポーネント
 * defaultValue（フィールド自身の値）を compute に渡してレンダリング
 */
const DerivedComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<DerivedSchema>) => {
  const meta = getMetaReact(schema, "derived") as DerivedRuntimeMeta | undefined;
  const context = useResolverContext(meta?.contextId);

  const content = runDerived(meta, defaultValue, context);

  return <>{renderComputedValue(content)}</>;
};

export { DerivedComponent as component };
