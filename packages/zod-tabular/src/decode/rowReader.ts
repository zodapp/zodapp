import type {
  CompiledNode,
  CompiledSchema,
  CellValue,
  PathToken,
} from "../types/internalTypes.js";
import { encodePathKey } from "../encode/encodePathKey.js";
import { pushField, pushIndex, pushRecordKey, pushControl, pop } from "../encode/pathToken.js";
import { resolveUnion } from "./unionResolver.js";

export function readRow(
  compiled: CompiledSchema,
  cells: Map<string, CellValue>,
  sortedColKeys: string[],
): unknown {
  const pathStack: PathToken[] = [];
  return readValue(compiled, compiled.root, cells, pathStack, sortedColKeys);
}

function readValue(
  compiled: CompiledSchema,
  node: CompiledNode,
  cells: Map<string, CellValue>,
  pathStack: PathToken[],
  sortedColKeys: string[],
): unknown {
  switch (node.kind) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const [key, entry] of node.fields) {
        pushField(pathStack, entry.fieldId);
        obj[key] = readValue(compiled, entry.childNode, cells, pathStack, sortedColKeys);
        pop(pathStack);
      }
      return obj;
    }
    case "array": {
      const prefix = encodePathKey(pathStack);
      const maxIndex = findMaxArrayIndex(prefix, sortedColKeys);
      if (maxIndex < 0) return [];
      const arr: unknown[] = [];
      for (let i = 0; i <= maxIndex; i++) {
        pushIndex(pathStack, i);
        arr.push(readValue(compiled, node.elementNode, cells, pathStack, sortedColKeys));
        pop(pathStack);
      }
      return arr;
    }
    case "record": {
      const prefix = encodePathKey(pathStack);
      const keys = findRecordKeys(prefix, sortedColKeys);
      const rec: Record<string, unknown> = {};
      for (const key of keys) {
        pushRecordKey(pathStack, key);
        rec[key] = readValue(compiled, node.valueNode, cells, pathStack, sortedColKeys);
        pop(pathStack);
      }
      return rec;
    }
    case "union": {
      pushControl(pathStack, node.controlId);
      const controlKey = encodePathKey(pathStack);
      const controlValue = cells.get(controlKey);
      pop(pathStack);

      const meta = compiled.controlIdMeta.get(node.controlId)!;
      const branch = resolveUnion(
        controlValue != null ? String(controlValue) : null,
        meta,
      );
      return readValue(compiled, branch.node, cells, pathStack, sortedColKeys);
    }
    case "leaf": {
      const key = encodePathKey(pathStack);
      const val = cells.get(key);
      return val === undefined ? null : val;
    }
  }
}

function findMaxArrayIndex(prefix: string, sortedColKeys: string[]): number {
  let max = -1;
  const search = prefix ? prefix + ".i" : "i";
  for (const key of sortedColKeys) {
    if (!key.startsWith(search)) continue;
    const rest = key.slice(search.length);
    const hexPart = rest.slice(0, 4);
    const idx = parseInt(hexPart, 16);
    if (!isNaN(idx) && idx > max) max = idx;
  }
  return max;
}

function findRecordKeys(prefix: string, sortedColKeys: string[]): string[] {
  const keys = new Set<string>();
  const search = prefix ? prefix + ".k" : "k";
  for (const key of sortedColKeys) {
    if (!key.startsWith(search)) continue;
    const rest = key.slice(search.length);
    const dotIdx = rest.indexOf(".");
    const encoded = dotIdx >= 0 ? rest.slice(0, dotIdx) : rest;
    keys.add(decodeURIComponent(encoded));
  }
  return [...keys];
}
