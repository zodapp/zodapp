import type { CompiledSchema } from "../types/internalTypes.js";
import { createRowWriterContext, writeValue } from "../encode/rowWriter.js";

export function collectColumns(
  compiled: CompiledSchema,
  rows: unknown[],
): Set<string> {
  const ctx = createRowWriterContext(true);
  for (const row of rows) {
    writeValue(ctx, compiled.root, row);
  }
  return ctx.colKeys;
}
