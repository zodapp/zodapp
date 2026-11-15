/**
 * React依存のスキーマ拡張
 * zf.computed をReact対応（+JSX）に拡張
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import z from "zod";
import {
  extendCustom,
  schemaType,
  getMeta as getZodExtendableMeta,
  MetaOf,
} from "@zodapp/zod-extendable";
import {
  zf,
  zodExtendableCommonDefSchema,
  fnSourceMetaSchema,
} from "@zodapp/zod-form";
import type { ComputedMetaDef, ComputedValue } from "@zodapp/zod-form";
import { reactNodeSchema } from "./reactNode";

// ComputedValue | ReactNode を受け付けるスキーマ
// React要素もComputedValueオブジェクトも両方許容する
const computedOrReactNodeSchema = z.union([
  reactNodeSchema,
  z.custom<ComputedValue>(),
]);

// computed: { value, parent, context } を受け取り ComputedValue | ReactNode を返す
// zf.computed を上書きし、JSX（ReactNode）も返せるように拡張
const computed = extendCustom(
  z.never,
  "computed",
  zodExtendableCommonDefSchema.extend({
    ...fnSourceMetaSchema.shape,
    compute: z.function({
      input: [z.any()],
      output: computedOrReactNodeSchema,
    }),
  }) as unknown as z.ZodType<ComputedMetaDef<ComputedValue | ReactNode>>,
  schemaType<z.ZodType>(),
);

/**
 * zfReact - React依存のスキーマ拡張を含むzf
 * zfの全機能に加えて、computed(+JSX)を提供
 */
export const zfReact = {
  ...zf,
  computed,
};

// Registry key types
type ZfReactRegistryKey = {
  [K in keyof typeof zfReact]: (typeof zfReact)[K] extends { registry: any }
    ? K
    : never;
}[keyof typeof zfReact];

/**
 * getMetaReact - zfReactのcomputedを含むgetMeta
 */
export const getMetaReact = <
  S extends z.ZodTypeAny,
  TypeName extends ZfReactRegistryKey = S["type"] extends ZfReactRegistryKey
    ? S["type"]
    : ZfReactRegistryKey,
>(
  schema: S,
  _typeName?: TypeName,
) => {
  return getZodExtendableMeta(schema) as MetaOf<
    (typeof zfReact)[TypeName]["registry"]
  >;
};

// Re-export reactNodeSchema for direct usage
export { reactNodeSchema, reactElementOrReactPortalSchema } from "./reactNode";
