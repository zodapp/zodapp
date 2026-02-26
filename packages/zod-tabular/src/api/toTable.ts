import type { z } from "zod";
import type { Table, TableCell } from "../types/publicTypes.js";
import { compileSchema } from "../compile/compileSchema.js";
import { collectColumns } from "../columns/collectColumns.js";
import { sortColumns } from "../columns/sortColumns.js";
import { decodeHeaders } from "../columns/decodeHeader.js";
import { createRowWriterContext, writeValue } from "../encode/rowWriter.js";

export function toTable<S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
): Table {
  const compiled = compileSchema(schema);

  const colKeys = collectColumns(compiled, rows);
  const sorted = sortColumns(colKeys);
  const headers = decodeHeaders(sorted, compiled);

  const headerRow: TableCell[] = headers;
  const result: TableCell[][] = [headerRow];

  for (const row of rows) {
    const ctx = createRowWriterContext(false);
    writeValue(ctx, compiled.root, row);

    const cells: TableCell[] = sorted.map((key) => {
      const val = ctx.row.get(key);
      return val === undefined ? null : val;
    });
    result.push(cells);
  }

  return result;
}
