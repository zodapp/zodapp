import type { SchemaColumnDef } from "./extract-schema-columns";

export function getDefaultOrderEntries(
  schemaColumns: SchemaColumnDef[],
  defaultFieldPaths?: string[],
): SchemaColumnDef[] {
  if (!defaultFieldPaths?.length) {
    return schemaColumns.filter((col) => col.isDefault);
  }

  const columnByPath = new Map(
    schemaColumns.map((column) => [column.fieldPath, column] as const),
  );
  const orderedDefaults: SchemaColumnDef[] = [];
  const usedFieldPaths = new Set<string>();

  for (const fieldPath of defaultFieldPaths) {
    const column = columnByPath.get(fieldPath);
    if (!column || usedFieldPaths.has(fieldPath)) continue;
    orderedDefaults.push(column);
    usedFieldPaths.add(fieldPath);
  }

  for (const column of schemaColumns) {
    if (!column.isDefault || usedFieldPaths.has(column.fieldPath)) continue;
    orderedDefaults.push(column);
  }

  return orderedDefaults;
}
