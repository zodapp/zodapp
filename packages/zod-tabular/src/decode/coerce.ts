import z from "zod";
import {
  preprocess,
  type PreprocessorDef,
  type ProcessorDef,
} from "@zodapp/zod-transform";

const tabularPreprocessor: PreprocessorDef = {
  number: (val) => {
    if (typeof val === "number") return val;
    if (val === null || val === undefined) return val;
    const s = String(val).trim();
    return s === "" ? undefined : Number(s);
  },
  boolean: (val) => {
    if (typeof val === "boolean") return val;
    if (val === null || val === undefined) return val;
    const s = String(val).trim().toLowerCase();
    return s === "true" || s === "1";
  },
  date: (val) => {
    if (val instanceof Date) return val;
    if (val === null || val === undefined) return val;
    const s = String(val).trim();
    return s === "" ? undefined : new Date(s);
  },
  bigint: (val) => {
    if (typeof val === "bigint") return val;
    if (val === null || val === undefined) return val;
    const s = String(val).trim();
    return s === "" ? undefined : BigInt(s);
  },
  string: (val) => {
    if (typeof val === "string") return val;
    if (val === null || val === undefined) return val;
    return String(val);
  },
  optional: (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  },
  nullable: (val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  },
  undefined: (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    return val;
  },
  null: (val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  },
};

const tabularProcessor: ProcessorDef = {
  union: (val) => val,
};

export function coerceRow<S extends z.ZodType>(
  schema: S,
  row: unknown,
): z.infer<S> {
  return preprocess(row, schema, tabularPreprocessor, {
    processor: tabularProcessor,
  });
}
