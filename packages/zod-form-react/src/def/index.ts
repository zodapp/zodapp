/**
 * React依存のスキーマ拡張
 * zf.computed, zf.derived をReact対応（+JSX）に拡張
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import z from "zod";
import {
  extendCustom,
  schemaType,
  getMeta as getZodExtendableMeta,
  MetaOf,
} from "@zodapp/zod-extendable";
import { zf, zodExtendableCommonDefSchema } from "@zodapp/zod-form";
import { reactNodeSchema } from "./reactNode";

// ComputedValue | ReactNode を受け付けるスキーマ
// React要素もComputedValueオブジェクトも両方許容する
const computedOrReactNodeSchema = z.union([
  reactNodeSchema,
  z.custom<import("@zodapp/zod-form").ComputedValue>(),
]);

// computed: 親オブジェクトを受け取り ComputedValue | ReactNode を返す
// zf.computed を上書きし、JSX（ReactNode）も返せるように拡張
const computed = extendCustom(
  z.never,
  "computed",
  zodExtendableCommonDefSchema.extend({
    compute: z.function({
      input: [z.any()],
      output: computedOrReactNodeSchema,
    }),
  }),
  schemaType<z.ZodType>(),
);

// derived: 該当フィールドの値を受け取り ComputedValue | ReactNode を返す
// zf.derived を上書きし、JSX（ReactNode）も返せるように拡張
const derived = extendCustom(
  z.never,
  "derived",
  zodExtendableCommonDefSchema.extend({
    compute: z.function({
      input: [z.any()],
      output: computedOrReactNodeSchema,
    }),
  }),
  schemaType<z.ZodType>(),
);

/**
 * zfReact - React依存のスキーマ拡張を含むzf
 * zfの全機能に加えて、computed(+JSX), derived(+JSX)を提供
 */
export const zfReact = {
  ...zf,
  computed,
  derived,
};

// Registry key types
type ZfReactRegistryKey = {
  [K in keyof typeof zfReact]: (typeof zfReact)[K] extends { registry: any }
    ? K
    : never;
}[keyof typeof zfReact];

/**
 * getMetaReact - zfReactのcomputed, derivedを含むgetMeta
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
