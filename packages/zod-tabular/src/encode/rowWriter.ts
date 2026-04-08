import type {
  CompiledNode,
  PathToken,
  CellValue,
} from "../types/internalTypes.js";
import { CONTROL_HEADER } from "../types/internalTypes.js";
import { encodePathKey } from "./encodePathKey.js";
import { pushField, pushIndex, pushRecordKey, pushControl, pop } from "./pathToken.js";

export interface RowWriterContext {
  pathStack: PathToken[];
  row: Map<string, CellValue>;
  colKeys: Set<string>;
  collectOnly: boolean;
}

export function createRowWriterContext(collectOnly: boolean): RowWriterContext {
  return {
    pathStack: [],
    row: new Map(),
    colKeys: new Set(),
    collectOnly,
  };
}

function currentKey(ctx: RowWriterContext): string {
  return encodePathKey(ctx.pathStack);
}

function emitCell(ctx: RowWriterContext, value: CellValue): void {
  const key = currentKey(ctx);
  ctx.colKeys.add(key);
  if (!ctx.collectOnly) {
    ctx.row.set(key, value);
  }
}

function leafToCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  return String(value);
}

export function writeValue(
  ctx: RowWriterContext,
  node: CompiledNode,
  value: unknown,
): void {
  if (value === undefined || value === null) {
    if (node.kind === "leaf") {
      emitCell(ctx, null);
    }
    return;
  }

  switch (node.kind) {
    case "object": {
      const obj = value as Record<string, unknown>;
      for (const [key, entry] of node.fields) {
        pushField(ctx.pathStack, entry.fieldId);
        writeValue(ctx, entry.childNode, obj[key]);
        pop(ctx.pathStack);
      }
      break;
    }
    case "array": {
      const arr = value as unknown[];
      for (let i = 0; i < arr.length; i++) {
        pushIndex(ctx.pathStack, i);
        writeValue(ctx, node.elementNode, arr[i]);
        pop(ctx.pathStack);
      }
      break;
    }
    case "record": {
      const rec = value as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        pushRecordKey(ctx.pathStack, key);
        writeValue(ctx, node.valueNode, rec[key]);
        pop(ctx.pathStack);
      }
      break;
    }
    case "union": {
      const branchId = detectBranchId(value);
      pushControl(ctx.pathStack, node.controlId);
      emitCell(ctx, branchId);
      pop(ctx.pathStack);

      const branch = node.branches.find((b) => b.branchId === branchId);
      if (branch) {
        writeValue(ctx, branch.node, value);
      }
      break;
    }
    case "leaf": {
      emitCell(ctx, leafToCell(value));
      break;
    }
  }
}

function detectBranchId(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return "date";
  const t = typeof value;
  if (t === "object") return "object";
  return t;
}
