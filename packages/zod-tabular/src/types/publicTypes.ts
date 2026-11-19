import type { z } from "zod";

export type TableCell = string | number | boolean | Date | null;
export type Table = TableCell[][];

export interface TableSchemaOptions {
  /**
   * true を返した schema の欄を表に出さない・読まない（z.never の欄と同じ扱い）。
   * object の欄の schema（optional などで包んだまま）で呼ぶ
   */
  skip?: (schema: z.ZodType) => boolean;
}

export type ToTableOptions = TableSchemaOptions;

export interface FromTableOptions extends TableSchemaOptions {
  booleanConverter?: (v: unknown) => boolean | undefined;
  numberConverter?: (v: unknown) => number | undefined;
  dateConverter?: (v: unknown) => Date | undefined;
  bigintConverter?: (v: unknown) => bigint | undefined;
}

export type ToTableFn = <S extends z.ZodType>(
  schema: S,
  rows: z.infer<S>[],
  options?: ToTableOptions,
) => Table;

export type FromTableFn = <S extends z.ZodType>(
  schema: S,
  table: Table,
  options?: FromTableOptions,
) => z.infer<S>[];
