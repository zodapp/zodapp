import type { z } from "zod";
import type { StringTable, TabularOptions } from "../types/publicTypes.js";
import { compileSchema } from "../compile/compileSchema.js";
import { collectColumns } from "../columns/collectColumns.js";
import { sortColumns } from "../columns/sortColumns.js";
import { decodeHeaders } from "../columns/decodeHeader.js";
import { createRowWriterContext, writeValue } from "../encode/rowWriter.js";

export function toStringTable<S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
  _options?: TabularOptions,
): StringTable {
  const compiled = compileSchema(schema);

  const colKeys = collectColumns(compiled, rows);
  const sorted = sortColumns(colKeys);
  const headers = decodeHeaders(sorted, compiled);

  const result: string[][] = [headers];

  for (const row of rows) {
    const ctx = createRowWriterContext(false);
    writeValue(ctx, compiled.root, row);

    const cells: string[] = sorted.map((key) => {
      const val = ctx.row.get(key);
      if (val === null || val === undefined) return "";
      if (val instanceof Date) return val.toISOString();
      return String(val);
    });
    result.push(cells);
  }

  return result;
}
