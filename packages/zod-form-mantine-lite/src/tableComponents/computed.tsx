import {
  ZodFormProps,
  zfReact as zf,
  getMetaReact,
} from "@zodapp/zod-form-react";
import type { ComputedMetaDef } from "@zodapp/zod-form";
import { useResolverContext } from "@zodapp/zod-form-react/common";
import { renderComputedValue } from "../utils/renderComputedValue";

type ComputedSchema = ReturnType<typeof zf.computed>;

type ComputedRuntimeMeta = ComputedMetaDef<unknown>;

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

const ComputedComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<ComputedSchema>) => {
  const meta = getMetaReact(schema, "computed") as ComputedRuntimeMeta | undefined;
  const context = useResolverContext(meta?.contextId);

  const content = runComputed(meta, defaultValue, context);

  return <>{renderComputedValue(content)}</>;
};

export { ComputedComponent as component };
