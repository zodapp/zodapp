import { getDefaultValue } from "@zodapp/zod-form";
import type { z } from "zod";

/**
 * 外から来た値を schema の既定値で補う（AutoForm・ReactiveAutoForm で共通）。
 * 補えなければ（optional の付かない z.lazy の無限の再帰など）、補わずに渡された値を使う
 */
export const fillDefaultValues = (
  schema: z.ZodTypeAny,
  values: unknown,
  name: string,
) => {
  try {
    return getDefaultValue(schema, values) ?? values ?? {};
  } catch (error) {
    console.error(
      `[${name}] Could not fill the default values from the schema:`,
      error,
    );
    return values ?? {};
  }
};
