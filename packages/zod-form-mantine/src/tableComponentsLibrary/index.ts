import { componentLibrary } from "../componentLibrary/index";
import type { ComponentLibrary } from "@zodapp/zod-form-react/common";
import * as objectComponent from "./object.js";
import * as stringComponent from "./string.js";
import * as numberComponent from "./number.js";
import * as dateComponent from "./date.js";
import * as enumComponent from "./enum.js";
import * as booleanComponent from "./boolean.js";
import * as arrayComponent from "./array.js";
import * as computedComponent from "./computed.js";

/**
 * テーブル表示向けの `ComponentLibrary`。
 *
 * `componentLibrary` をベースに、テーブル専用の UI 実装で上書きしたライブラリです。
 */
export const tableComponentLibrary: ComponentLibrary = {
  optional: componentLibrary.optional!,
  nullable: componentLibrary.nullable!,
  default: componentLibrary.default!,
  // テーブル専用コンポーネントで上書き
  object: () => objectComponent,
  string: () => stringComponent,
  number: () => numberComponent,
  date: () => dateComponent,
  enum: () => enumComponent,
  enum_badge: () => enumComponent,
  boolean: () => booleanComponent,
  array: () => arrayComponent,
  computed: () => computedComponent,
  // optional, nullable は既存のものをそのまま使用（UI実装を持たないため）
};
