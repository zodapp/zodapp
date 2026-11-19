import type {
  ComponentLibrary,
  DynamicZodFormDef,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite";

// Named exports（個別 static import 用）
export { component as ArrayComponent } from "./array.js";
export { component as ArrayTableComponent } from "./array_table.js";
export { component as ArrayOfEnumComponent } from "./array_multipleEnum.js";
export { component as ArrayOfExternalKeyComponent } from "./array_multipleExternalKey.js";
export { component as ArrayOfStringComponent } from "./array_multipleString.js";
export { component as BigIntComponent } from "./bigint.js";
export { component as BooleanComponent } from "./boolean.js";
export { component as BooleanCheckboxComponent } from "./boolean_checkbox.js";
export { component as BooleanSelectComponent } from "./boolean_select.js";
export { component as ComputedComponent } from "./computed.js";
export { component as DateComponent } from "./date.js";
export { component as TimeComponent } from "./time.js";
export { component as EnumComponent } from "./enum.js";
export { component as ExternalKeyComponent } from "./externalKey.js";
export { component as ExternalFileComponent } from "./externalFile.js";
export { component as LiteralComponent } from "./literal.js";
export { component as NumberComponent } from "./number.js";
export { component as NumberSliderComponent } from "./number_slider.js";
export { component as ObjectComponent } from "./object.js";
export { component as RecordComponent } from "./record.js";
export { component as RecordEntriesComponent } from "./record_entries.js";
export { component as DynamicComponent } from "./dynamic.js";
export { component as StringComponent } from "./string.js";
export { component as StringLazyComponent } from "./string_lazy.js";
export { component as StringMultilineComponent } from "./string_multiline.js";
export { component as StringPasswordComponent } from "./string_password.js";
export { component as StringSelectComponent } from "./string_select.js";
export { component as TupleComponent } from "./tuple.js";
export { component as UnionComponent } from "./union.js";
export { component as IntersectionComponent } from "./intersection.js";

// Library（dynamic import による lazy load — Library 自体を使わなければ tree shake で除外される）
export const componentLibrary: ComponentLibrary = {
  ...baseComponents,
  array: (() => import("./array.js")) as DynamicZodFormDef,
  array_table: (() => import("./array_table.js")) as DynamicZodFormDef,
  array_multipleEnum: (() =>
    import("./array_multipleEnum.js")) as DynamicZodFormDef,
  array_multipleEnumBadge: (() =>
    import("./array_multipleEnum.js")) as DynamicZodFormDef,
  array_multipleExternalKey: (() =>
    import("./array_multipleExternalKey.js")) as DynamicZodFormDef,
  array_multipleString: (() =>
    import("./array_multipleString.js")) as DynamicZodFormDef,
  bigint: (() => import("./bigint.js")) as DynamicZodFormDef,
  boolean: (() => import("./boolean.js")) as DynamicZodFormDef,
  boolean_checkbox: (() =>
    import("./boolean_checkbox.js")) as DynamicZodFormDef,
  boolean_select: (() => import("./boolean_select.js")) as DynamicZodFormDef,
  computed: (() => import("./computed.js")) as DynamicZodFormDef,
  date: (() => import("./date.js")) as DynamicZodFormDef,
  time: (() => import("./time.js")) as DynamicZodFormDef,
  enum: (() => import("./enum.js")) as DynamicZodFormDef,
  enum_badge: (() => import("./enum.js")) as DynamicZodFormDef,
  externalKey: (() => import("./externalKey.js")) as DynamicZodFormDef,
  externalFile: (() => import("./externalFile.js")) as DynamicZodFormDef,
  literal: (() => import("./literal.js")) as DynamicZodFormDef,
  // 値を複数持つ literal を、enum と同じ見た目で選ぶ
  literal_select: (() => import("./literal.js")) as DynamicZodFormDef,
  literal_badge: (() => import("./literal.js")) as DynamicZodFormDef,
  // 固定値（既定で出さない）
  null: (() => import("./null.js")) as DynamicZodFormDef,
  undefined: (() => import("./undefined.js")) as DynamicZodFormDef,
  void: (() => import("./void.js")) as DynamicZodFormDef,
  number: (() => import("./number.js")) as DynamicZodFormDef,
  number_slider: (() => import("./number_slider.js")) as DynamicZodFormDef,
  object: (() => import("./object.js")) as DynamicZodFormDef,
  record: (() => import("./record.js")) as DynamicZodFormDef,
  set: (() => import("./set.js")) as DynamicZodFormDef,
  record_entries: (() => import("./record_entries.js")) as DynamicZodFormDef,
  dynamic: (() => import("./dynamic.js")) as DynamicZodFormDef,
  string: (() => import("./string.js")) as DynamicZodFormDef,
  string_multiline: (() =>
    import("./string_multiline.js")) as DynamicZodFormDef,
  string_lazy: (() => import("./string_lazy.js")) as DynamicZodFormDef,
  string_password: (() => import("./string_password.js")) as DynamicZodFormDef,
  string_select: (() => import("./string_select.js")) as DynamicZodFormDef,
  tuple: (() => import("./tuple.js")) as DynamicZodFormDef,
  union: (() => import("./union.js")) as DynamicZodFormDef,
  intersection: (() => import("./intersection.js")) as DynamicZodFormDef,
  // literal だけの union を、enum と同じ部品で選ぶ（腕の番号で Select とやりとりする）
  union_select: (() => import("./enum.js")) as DynamicZodFormDef,
  union_badge: (() => import("./enum.js")) as DynamicZodFormDef,
};
