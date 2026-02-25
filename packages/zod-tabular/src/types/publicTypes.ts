import type { z } from "zod";

export type StringRow = string[];
export type StringTable = StringRow[];

export type TypedCell = string | number | boolean | Date | null;
export type TypedRow = TypedCell[];
export type TypedTable = TypedRow[];

export interface TabularOptions {
  // reserved for future extensions
}

export type ToStringTableFn = <S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
  options?: TabularOptions,
) => StringTable;

export type FromStringTableFn = <S extends z.ZodType>(
  schema: S,
  table: StringTable,
  options?: TabularOptions,
) => z.infer<S>[];

export type ToTypedTableFn = <S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
  options?: TabularOptions,
) => TypedTable;

export type FromTypedTableFn = <S extends z.ZodType>(
  schema: S,
  table: TypedTable,
  options?: TabularOptions,
) => z.infer<S>[];
