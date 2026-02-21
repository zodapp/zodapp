import { componentLibrary } from "../componentLibrary/index";
import type {
  DynamicZodFormDef,
  ComponentLibrary,
} from "@zodapp/zod-form-react/common";

/**
 * Reactive（@tanstack/react-form 非依存）な `ComponentLibrary`。
 *
 * `defaultValue` でデータを受け取り、変更は `onFieldChange(fieldPath, value)` で通知する。
 * 全編集コンポーネントに confirm UI（確認/キャンセル）を備える。
 *
 * unwrap 系（optional, nullable, default, lazy, hidden）は componentLibrary のものを再利用。
 * union, array は非対応。
 */
export const reactiveComponentLibrary: ComponentLibrary = {
  // unwrap 系は componentLibrary をそのまま使用（Dynamic に委譲するだけで tanstack 非依存）
  optional: componentLibrary.optional!,
  nullable: componentLibrary.nullable!,
  default: componentLibrary.default!,
  lazy: componentLibrary.lazy!,
  hidden: componentLibrary.hidden!,

  // reactive 版コンポーネント
  string: (() => import("./string.js")) as DynamicZodFormDef,
  string_multiline: (() =>
    import("./string_multiline.js")) as DynamicZodFormDef,
  number: (() => import("./number.js")) as DynamicZodFormDef,
  boolean: (() => import("./boolean.js")) as DynamicZodFormDef,
  enum: (() => import("./enum.js")) as DynamicZodFormDef,
  enum_badge: (() => import("./enum.js")) as DynamicZodFormDef,
  date: (() => import("./date.js")) as DynamicZodFormDef,
  externalKey: (() => import("./externalKey.js")) as DynamicZodFormDef,
  literal: (() => import("./literal.js")) as DynamicZodFormDef,
  derived: (() => import("./derived.js")) as DynamicZodFormDef,
  object: (() => import("./object.js")) as DynamicZodFormDef,
};
