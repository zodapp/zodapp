import type { ComponentLibrary } from "@zodapp/zod-form-react/common";
import * as defaultComponent from "./default.js";
import * as optionalComponent from "./optional.js";
import * as nullableComponent from "./nullable.js";
import * as lazyComponent from "./lazy.js";
import * as hiddenComponent from "./hidden.js";

/**
 * TanStack 非依存の unwrap / パススルー系コンポーネント。
 *
 * optional, nullable, default, lazy, hidden などスキーマを unwrap して
 * `Dynamic` に委譲するだけのコンポーネントをまとめたライブラリ。
 * componentLibrary / tableComponents / reactiveComponents から共有される。
 */
export const baseComponents = {
  default: () => defaultComponent,
  optional: () => optionalComponent,
  nullable: () => nullableComponent,
  lazy: () => lazyComponent,
  hidden: () => hiddenComponent,
} as const satisfies ComponentLibrary;
