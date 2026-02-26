import { baseComponents } from "../baseComponents/index";
import type { ComponentLibrary } from "@zodapp/zod-form-react/common";
import * as objectComponent from "./object.js";
import * as stringComponent from "./string.js";
import * as numberComponent from "./number.js";
import * as dateComponent from "./date.js";
import * as enumComponent from "./enum.js";
import * as booleanComponent from "./boolean.js";
import * as arrayComponent from "./array.js";
import * as computedComponent from "./computed.js";
import * as derivedComponent from "./derived.js";
import * as externalKeyComponent from "./externalKey.js";

/**
 * テーブル表示向けの `ComponentLibrary`。
 *
 * `baseComponents` をベースに、テーブル専用の UI 実装で上書きしたライブラリです。
 */
export const tableComponentLibrary: ComponentLibrary = {
  optional: baseComponents.optional!,
  nullable: baseComponents.nullable!,
  default: baseComponents.default!,
  externalKey: () => externalKeyComponent,
  object: () => objectComponent,
  string: () => stringComponent,
  number: () => numberComponent,
  date: () => dateComponent,
  enum: () => enumComponent,
  enum_badge: () => enumComponent,
  boolean: () => booleanComponent,
  array: () => arrayComponent,
  computed: () => computedComponent,
  derived: () => derivedComponent,
};
