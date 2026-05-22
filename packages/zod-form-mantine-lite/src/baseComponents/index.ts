import type { ComponentLibrary } from "@zodapp/zod-form-react/common";

// Named exports（個別 static import 用）
export { component as OptionalComponent } from "./optional.js";
export { component as NullableComponent } from "./nullable.js";
export { component as DefaultComponent } from "./default.js";
export { component as LazyComponent } from "./lazy.js";
export { component as HiddenComponent } from "./hidden.js";
export { component as PipeComponent } from "./pipe.js";

// Library（baseComponents は軽量なので static import で組み立て）
import * as optionalModule from "./optional.js";
import * as nullableModule from "./nullable.js";
import * as defaultModule from "./default.js";
import * as lazyModule from "./lazy.js";
import * as hiddenModule from "./hidden.js";
import * as pipeModule from "./pipe.js";

export const baseComponents = {
  optional: () => optionalModule,
  nullable: () => nullableModule,
  default: () => defaultModule,
  lazy: () => lazyModule,
  hidden: () => hiddenModule,
  pipe: () => pipeModule,
} as const satisfies ComponentLibrary;
