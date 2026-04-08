import type { z } from "zod";

export type TableCell = string | number | boolean | Date | null;
export type Table = TableCell[][];

export interface FromTableOptions {
  booleanConverter?: (v: unknown) => boolean | undefined;
  numberConverter?: (v: unknown) => number | undefined;
  dateConverter?: (v: unknown) => Date | undefined;
  bigintConverter?: (v: unknown) => bigint | undefined;
}

export type ToTableFn = <S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
) => Table;

export type FromTableFn = <S extends z.ZodType>(
  schema: S,
  table: Table,
  options?: FromTableOptions,
) => z.infer<S>[];
