import type {
  CompiledNode,
  CompiledSchema,
  CellValue,
  PathToken,
} from "../types/internalTypes.js";
import { encodePathKey } from "../encode/encodePathKey.js";
import { pushField, pushIndex, pushRecordKey, pushControl, pop } from "../encode/pathToken.js";
import { resolveUnion } from "./unionResolver.js";

interface ReadResult {
  value: unknown;
  hasNonBlankCell: boolean;
}

export function readRow(
  compiled: CompiledSchema,
  cells: Map<string, CellValue>,
  sortedColKeys: string[],
): unknown {
  const pathStack: PathToken[] = [];
  return readValue(compiled, compiled.root, cells, pathStack, sortedColKeys, true).value;
}

function readValue(
  compiled: CompiledSchema,
  node: CompiledNode,
  cells: Map<string, CellValue>,
  pathStack: PathToken[],
  sortedColKeys: string[],
  preserveBlankObject = false,
): ReadResult {
  switch (node.kind) {
    case "object": {
      const obj: Record<string, unknown> = {};
      let hasNonBlankCell = false;
      for (const [key, entry] of node.fields) {
        pushField(pathStack, entry.fieldId);
        const child = readValue(compiled, entry.childNode, cells, pathStack, sortedColKeys);
        pop(pathStack);
        obj[key] = child.value;
        hasNonBlankCell ||= child.hasNonBlankCell;
      }
      return {
        value: hasNonBlankCell || preserveBlankObject ? obj : undefined,
        hasNonBlankCell,
      };
    }
    case "array": {
      const prefix = encodePathKey(pathStack);
      const maxIndex = findMaxArrayIndex(prefix, sortedColKeys);
      if (maxIndex < 0) {
        return { value: undefined, hasNonBlankCell: false };
      }
      const arr: unknown[] = [];
      const elementHasNonBlankCell: boolean[] = [];
      for (let i = 0; i <= maxIndex; i++) {
        pushIndex(pathStack, i);
        const child = readValue(compiled, node.elementNode, cells, pathStack, sortedColKeys);
        pop(pathStack);
        arr.push(child.value);
        elementHasNonBlankCell.push(child.hasNonBlankCell);
      }
      const lastNonBlankIndex = findLastNonBlankIndex(elementHasNonBlankCell);
      if (lastNonBlankIndex < 0) {
        return { value: undefined, hasNonBlankCell: false };
      }
      return {
        value: arr.slice(0, lastNonBlankIndex + 1),
        hasNonBlankCell: true,
      };
    }
    case "record": {
      const prefix = encodePathKey(pathStack);
      const keys = findRecordKeys(prefix, sortedColKeys);
      const rec: Record<string, unknown> = {};
      let hasNonBlankCell = false;
      for (const key of keys) {
        pushRecordKey(pathStack, key);
        const child = readValue(compiled, node.valueNode, cells, pathStack, sortedColKeys);
        pop(pathStack);
        if (child.hasNonBlankCell) {
          rec[key] = child.value;
          hasNonBlankCell = true;
        }
      }
      return {
        value: hasNonBlankCell ? rec : undefined,
        hasNonBlankCell,
      };
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
      const child = readValue(compiled, branch.node, cells, pathStack, sortedColKeys);
      return {
        value: child.value,
        hasNonBlankCell: !isBlankCell(controlValue) || child.hasNonBlankCell,
      };
    }
    case "leaf": {
      const key = encodePathKey(pathStack);
      const val = cells.get(key);
      return {
        value: val === undefined ? null : val,
        hasNonBlankCell: !isBlankCell(val),
      };
    }
  }
}

function isBlankCell(value: CellValue | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function findLastNonBlankIndex(values: boolean[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i]) return i;
  }
  return -1;
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
