import type { z } from "zod";
import { getUnwrappedMeta } from "../table/table-types";

/**
 * CSV の書き出し・読み込みで、zf.dynamic の欄を飛ばす（実行時に決まる schema は表の列にできないため）。
 * zod-tabular の `skip` に渡す
 */
export const skipDynamicColumn = (schema: z.ZodType): boolean =>
  getUnwrappedMeta(schema as z.ZodTypeAny)?.typeName === "dynamic";

export const tabularOptions = { skip: skipDynamicColumn } as const;
