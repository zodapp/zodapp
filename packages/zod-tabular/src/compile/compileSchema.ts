import z from "zod";
import type {
  CompiledNode,
  CompiledSchema,
  UnionMeta,
} from "../types/internalTypes.js";
import { MAX_ID } from "../types/internalTypes.js";
import { ErrorCode } from "../errors/errorCodes.js";
import { createError } from "../errors/createError.js";
import { unwrap } from "./unwrap.js";
import { buildUnionMeta } from "./union.js";

export function compileSchema(schema: z.ZodType): CompiledSchema {
  const fieldIdToName = new Map<number, string>();
  const controlIdMeta = new Map<number, UnionMeta>();

  let nextFieldId = 0;
  let nextControlId = 0;
  const visited = new WeakMap<z.ZodType, CompiledNode>();

  function allocFieldId(name: string): number {
    const id = nextFieldId++;
    if (id > MAX_ID) {
      throw createError(
        ErrorCode.E_ID_OVERFLOW,
        `Field ID overflow: "${name}" exceeds ${MAX_ID}`,
      );
    }
    fieldIdToName.set(id, name);
    return id;
  }

  function allocControlId(): number {
    const id = nextControlId++;
    if (id > MAX_ID) {
      throw createError(
        ErrorCode.E_ID_OVERFLOW,
        `Control ID overflow: exceeds ${MAX_ID}`,
      );
    }
    return id;
  }

  function compile(node: z.ZodType): CompiledNode {
    const cached = visited.get(node);
    if (cached) return cached;

    const base = unwrap(node);
    const typeName: string = base._zod.def.type;

    let result: CompiledNode;

    if (base instanceof z.ZodNever) {
      result = null as unknown as CompiledNode;
    } else if (base instanceof z.ZodObject) {
      const shape = base.shape as Record<string, z.ZodType>;
      const fields = new Map<string, { fieldId: number; childNode: CompiledNode }>();
      for (const key of Object.keys(shape)) {
        const childNode = compile(shape[key]!);
        if (!childNode) continue;
        const fieldId = allocFieldId(key);
        fields.set(key, { fieldId, childNode });
      }
      result = { kind: "object", fields };
    } else if (base instanceof z.ZodArray) {
      const elementNode = compile(base.element as z.ZodType);
      result = { kind: "array", elementNode };
    } else if (base instanceof z.ZodRecord) {
      const rec = base as z.ZodRecord;
      const valType = (rec as unknown as { valueType?: z.ZodType }).valueType;
      if (valType) {
        result = { kind: "record", valueNode: compile(valType) };
      } else {
        result = { kind: "record", valueNode: { kind: "leaf", zodTypeName: "unknown" } };
      }
    } else if (base instanceof z.ZodDiscriminatedUnion) {
      const opts = (base as z.ZodDiscriminatedUnion).options as z.ZodType[];
      const merged = new Map<string, { fieldId: number; childNode: CompiledNode }>();
      for (const opt of opts) {
        const compiled = compile(opt);
        if (compiled.kind === "object") {
          for (const [key, entry] of compiled.fields) {
            if (!merged.has(key)) {
              merged.set(key, entry);
            }
          }
        }
      }
      result = { kind: "object", fields: merged };
    } else if (base instanceof z.ZodUnion) {
      const controlId = allocControlId();
      const options = (base as z.ZodUnion).options as z.ZodType[];
      const meta = buildUnionMeta(options, controlId, compile);
      controlIdMeta.set(controlId, meta);
      result = {
        kind: "union",
        controlId,
        branches: meta.branches,
      };
    } else {
      result = { kind: "leaf", zodTypeName: typeName };
    }

    visited.set(node, result);
    return result;
  }

  const root = compile(schema);
  return { root, fieldIdToName, controlIdMeta };
}
