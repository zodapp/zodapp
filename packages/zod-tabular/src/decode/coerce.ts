import z from "zod";
import {
  preprocess,
  type PreprocessorDef,
  type ProcessorDef,
} from "@zodapp/zod-transform";
import type { FromTableOptions } from "../types/publicTypes.js";

function buildPreprocessor(options?: FromTableOptions): PreprocessorDef {
  const bc = options?.booleanConverter;
  const nc = options?.numberConverter;
  const dc = options?.dateConverter;
  const bic = options?.bigintConverter;

  return {
    number: (val) => {
      if (typeof val === "number") return val;
      if (val === null || val === undefined) return val;
      if (nc) {
        const r = nc(val);
        if (r !== undefined) return r;
      }
      const s = String(val).trim();
      return s === "" ? undefined : Number(s);
    },
    boolean: (val) => {
      if (typeof val === "boolean") return val;
      if (val === null || val === undefined) return val;
      if (bc) {
        const r = bc(val);
        if (r !== undefined) return r;
      }
      if (typeof val === "number") return val === 1 ? true : val === 0 ? false : undefined;
      if (typeof val === "string") {
        const s = val.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
        return undefined;
      }
      return undefined;
    },
    date: (val) => {
      if (val instanceof Date) return val;
      if (val === null || val === undefined) return val;
      if (dc) {
        const r = dc(val);
        if (r !== undefined) return r;
      }
      if (typeof val === "string") {
        const s = val.trim();
        return s === "" ? undefined : new Date(s);
      }
      return undefined;
    },
    bigint: (val) => {
      if (typeof val === "bigint") return val;
      if (val === null || val === undefined) return val;
      if (bic) {
        const r = bic(val);
        if (r !== undefined) return r;
      }
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
}

const tabularProcessor: ProcessorDef = {
  union: (val) => val,
};

export function coerceRow<S extends z.ZodType>(
  schema: S,
  row: unknown,
  options?: FromTableOptions,
): z.infer<S> {
  return preprocess(row, schema, buildPreprocessor(options), {
    processor: tabularProcessor,
  });
}
