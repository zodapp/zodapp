/**
 * React依存のスキーマ拡張
 * zf.message, zf.computed をReact非依存のzfに追加
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

// message: ReactNodeをcontentとして持つ
const message = extendCustom(
  z.never,
  "message",
  zodExtendableCommonDefSchema.extend({
    content: reactNodeSchema,
  }),
);

// computed: ReactNodeを返すcompute関数を持つ
const computed = extendCustom(
  z.never,
  "computed",
  zodExtendableCommonDefSchema.extend({
    compute: z.function({
      input: [z.any()],
      output: reactNodeSchema,
    }),
  }),
  schemaType<z.ZodType>(),
);

/**
 * zfReact - React依存のスキーマ拡張を含むzf
 * zfの全機能に加えて、message, computedを提供
 */
export const zfReact = {
  ...zf,
  message,
  computed,
};

// Registry key types
type ZfReactRegistryKey = {
  [K in keyof typeof zfReact]: (typeof zfReact)[K] extends { registry: any }
    ? K
    : never;
}[keyof typeof zfReact];

/**
 * getMetaReact - zfReactのmessage, computedを含むgetMeta
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
