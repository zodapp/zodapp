import { type ComponentLibrary } from "@zodapp/zod-form-react/common";

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
export const componentLibrary: ComponentLibrary = {
  array: () => import("./array.js"),
  array_multipleEnum: () => import("./array_multipleEnum.js"),
  array_multipleEnumBudge: () => import("./array_multipleEnum.js"), // array_multipleEnumとコンポーネント内で分岐
  array_multipleExternalKey: () => import("./array_multipleExternalKey.js"),
  array_multipleString: () => import("./array_multipleString.js"),
  bigint: () => import("./bigint.js"),
  boolean: () => import("./boolean.js"),
  computed: () => import("./computed.js"),
  date: () => import("./date.js"),
  default: () => defaultComponent,
  enum: () => import("./enum.js"),
  enum_badge: () => import("./enum.js"), // enumとコンポーネント内で分岐
  externalKey: () => import("./externalKey.js"),
  file: () => import("./file.js"),
  hidden: () => hiddenComponent,
  lazy: () => lazyComponent,
  literal: () => import("./literal.js"),
  message: () => import("./message.js"),
  nullable: () => nullableComponent,
  number: () => import("./number.js"),
  number_slider: () => import("./number_slider.js"),
  object: () => import("./object.js"),
  optional: () => optionalComponent,
  string: () => import("./string.js"),
  string_lazy: () => import("./string_lazy.js"),
  string_password: () => import("./string_password.js"),
  tuple: () => import("./tuple.js"),
  union: () => import("./union.js"),
};
