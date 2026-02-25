import type { z } from "zod";
import type { StringTable, TabularOptions } from "../types/publicTypes.js";
import type { CellValue } from "../types/internalTypes.js";
import { compileSchema } from "../compile/compileSchema.js";
import { resolveHeaderToColKey } from "../columns/encodeHeader.js";
import { readRow } from "../decode/rowReader.js";
import { coerceRow } from "../decode/coerce.js";

export function fromStringTable<S extends z.ZodType>(
  schema: S,
  table: StringTable,
  _options?: TabularOptions,
): z.infer<S>[] {
  if (table.length < 1) return [];

  const compiled = compileSchema(schema);
  const inputHeaders = table[0]!;

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
    results.push(coerceRow(schema, raw));
  }

  return results;
}
