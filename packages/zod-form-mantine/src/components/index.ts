import {
  DynamicZodFormDef,
  type ComponentLibrary,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite";

/**
 * Mantine UI 用の `ComponentLibrary`（ZodForm のコンポーネント対応表）。
 *
 * key は `typeName` や `typeName_uiType` を想定し、value は `{ component }` を返すローダです。
 * unwrap 系（optional, nullable, default, lazy, hidden）は lite パッケージの baseComponents を使用。
 */
export const componentLibrary: ComponentLibrary = {
  // unwrap 系は baseComponents から取得（TanStack 非依存）
  default: baseComponents.default,
  hidden: baseComponents.hidden,
  lazy: baseComponents.lazy,
  nullable: baseComponents.nullable,
  optional: baseComponents.optional,

  // TanStack 依存コンポーネント
  array: (() => import("./array.js")) as DynamicZodFormDef,
  array_multipleEnum: (() =>
    import("./array_multipleEnum.js")) as DynamicZodFormDef,
  array_multipleEnumBudge: () => import("./array_multipleEnum.js"),
  array_multipleExternalKey: (() =>
    import("./array_multipleExternalKey.js")) as DynamicZodFormDef,
  array_multipleString: (() =>
    import("./array_multipleString.js")) as DynamicZodFormDef,
  bigint: (() => import("./bigint.js")) as DynamicZodFormDef,
  boolean: (() => import("./boolean.js")) as DynamicZodFormDef,
  computed: (() => import("./computed.js")) as DynamicZodFormDef,
  date: (() => import("./date.js")) as DynamicZodFormDef,
  enum: (() => import("./enum.js")) as DynamicZodFormDef,
  enum_badge: () => import("./enum.js"),
  externalKey: (() => import("./externalKey.js")) as DynamicZodFormDef,
  file: (() => import("./file.js")) as DynamicZodFormDef,
  literal: (() => import("./literal.js")) as DynamicZodFormDef,
  derived: (() => import("./derived.js")) as DynamicZodFormDef,
  number: (() => import("./number.js")) as DynamicZodFormDef,
  number_slider: (() => import("./number_slider.js")) as DynamicZodFormDef,
  object: (() => import("./object.js")) as DynamicZodFormDef,
  record: (() => import("./record.js")) as DynamicZodFormDef,
  string: (() => import("./string.js")) as DynamicZodFormDef,
  string_multiline: (() =>
    import("./string_multiline.js")) as DynamicZodFormDef,
  string_lazy: (() => import("./string_lazy.js")) as DynamicZodFormDef,
  string_password: (() => import("./string_password.js")) as DynamicZodFormDef,
  tuple: (() => import("./tuple.js")) as DynamicZodFormDef,
  union: (() => import("./union.js")) as DynamicZodFormDef,
};
