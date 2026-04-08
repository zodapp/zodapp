import type { z } from "zod";
import type { Table, FromTableOptions } from "../types/publicTypes.js";
import type { CellValue } from "../types/internalTypes.js";
import { compileSchema } from "../compile/compileSchema.js";
import { resolveHeaderToColKey } from "../columns/encodeHeader.js";
import { readRow } from "../decode/rowReader.js";
import { coerceRow } from "../decode/coerce.js";

export function fromTable<S extends z.ZodType>(
  schema: S,
  table: Table,
  options?: FromTableOptions,
): z.infer<S>[] {
  if (table.length < 1) return [];

  const compiled = compileSchema(schema);
  const inputHeaders = table[0]!.map(String);

  const colKeyByCol: (string | null)[] = inputHeaders.map((h) =>
    resolveHeaderToColKey(h, compiled),
  );

  const allColKeys = colKeyByCol.filter((k): k is string => k !== null).sort();

  const results: z.infer<S>[] = [];

  for (let r = 1; r < table.length; r++) {
    const rowData = table[r]!;
    const cells = new Map<string, CellValue>();

    for (let c = 0; c < inputHeaders.length; c++) {
      const colKey = colKeyByCol[c];
      if (colKey) {
        const val = rowData[c];
        cells.set(colKey, val === undefined ? null : val);
      }
    }

    const raw = readRow(compiled, cells, allColKeys);
    const coerced = coerceRow(schema, raw, options);
    const parsed = schema.safeParse(coerced);
    if (parsed.success) {
      results.push(parsed.data);
    }
  }

  return results;
}
