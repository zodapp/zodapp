import {
  DynamicZodFormDef,
  type ComponentLibrary,
} from "@zodapp/zod-form-react/common";

// unwrap系コンポーネントは静的インポート（Suspense回避）
import * as defaultComponent from "./default.js";
import * as optionalComponent from "./optional.js";
import * as nullableComponent from "./nullable.js";
import * as lazyComponent from "./lazy.js";
import * as hiddenComponent from "./hidden.js";

/**
 * Mantine UI 用の `ComponentLibrary`（ZodForm のコンポーネント対応表）。
 *
 * key は `typeName` や `typeName_uiType` を想定し、value は `{ component }` を返すローダです。
 */
export const componentLibrary = {
  array: (() => import("./array.js")) as DynamicZodFormDef,
  array_multipleEnum: (() =>
    import("./array_multipleEnum.js")) as DynamicZodFormDef,
  array_multipleEnumBudge: () => import("./array_multipleEnum.js"), // array_multipleEnumとコンポーネント内で分岐
  array_multipleExternalKey: (() =>
    import("./array_multipleExternalKey.js")) as DynamicZodFormDef,
  array_multipleString: (() =>
    import("./array_multipleString.js")) as DynamicZodFormDef,
  bigint: (() => import("./bigint.js")) as DynamicZodFormDef,
  boolean: (() => import("./boolean.js")) as DynamicZodFormDef,
  computed: (() => import("./computed.js")) as DynamicZodFormDef,
  date: (() => import("./date.js")) as DynamicZodFormDef,
  default: () => defaultComponent,
  enum: (() => import("./enum.js")) as DynamicZodFormDef,
  enum_badge: () => import("./enum.js"), // enumとコンポーネント内で分岐
  externalKey: (() => import("./externalKey.js")) as DynamicZodFormDef,
  file: (() => import("./file.js")) as DynamicZodFormDef,
  hidden: () => hiddenComponent,
  lazy: () => lazyComponent,
  literal: (() => import("./literal.js")) as DynamicZodFormDef,
  message: (() => import("./message.js")) as DynamicZodFormDef,
  nullable: () => nullableComponent,
  number: (() => import("./number.js")) as DynamicZodFormDef,
  number_slider: (() => import("./number_slider.js")) as DynamicZodFormDef,
  object: (() => import("./object.js")) as DynamicZodFormDef,
  optional: () => optionalComponent,
  string: (() => import("./string.js")) as DynamicZodFormDef,
  string_lazy: (() => import("./string_lazy.js")) as DynamicZodFormDef,
  string_password: (() => import("./string_password.js")) as DynamicZodFormDef,
  tuple: (() => import("./tuple.js")) as DynamicZodFormDef,
  union: (() => import("./union.js")) as DynamicZodFormDef,
} as const satisfies ComponentLibrary;
