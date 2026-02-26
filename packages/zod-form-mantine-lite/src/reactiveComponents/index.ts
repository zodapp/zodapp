import type { ComponentLibrary, DynamicZodFormDef } from "@zodapp/zod-form-react/common";
import { baseComponents } from "../baseComponents/index";

// Named exports（個別 static import 用）
export { component as StringComponent } from "./string.js";
export { component as StringMultilineComponent } from "./string_multiline.js";
export { component as NumberComponent } from "./number.js";
export { component as BooleanComponent } from "./boolean.js";
export { component as EnumComponent } from "./enum.js";
export { component as DateComponent } from "./date.js";
export { component as ExternalKeyComponent } from "./externalKey.js";
export { component as LiteralComponent } from "./literal.js";
export { component as DerivedComponent } from "./derived.js";
export { component as ObjectComponent } from "./object.js";
export { component as RecordComponent } from "./record.js";

// Library（dynamic import による lazy load — Library 自体を使わなければ tree shake で除外される）
export const reactiveComponentLibrary: ComponentLibrary = {
  ...baseComponents,
  string: (() => import("./string.js")) as DynamicZodFormDef,
  string_multiline: (() => import("./string_multiline.js")) as DynamicZodFormDef,
  number: (() => import("./number.js")) as DynamicZodFormDef,
  boolean: (() => import("./boolean.js")) as DynamicZodFormDef,
  enum: (() => import("./enum.js")) as DynamicZodFormDef,
  enum_badge: (() => import("./enum.js")) as DynamicZodFormDef,
  date: (() => import("./date.js")) as DynamicZodFormDef,
  externalKey: (() => import("./externalKey.js")) as DynamicZodFormDef,
  literal: (() => import("./literal.js")) as DynamicZodFormDef,
  derived: (() => import("./derived.js")) as DynamicZodFormDef,
  object: (() => import("./object.js")) as DynamicZodFormDef,
  record: (() => import("./record.js")) as DynamicZodFormDef,
};
