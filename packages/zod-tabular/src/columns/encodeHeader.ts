import type { CompiledNode, CompiledSchema } from "../types/internalTypes.js";

function hex4(n: number): string {
  return n.toString(16).padStart(4, "0");
}

interface Segment {
  type: "field" | "index" | "recordKey" | "control";
  value: string | number;
}

function parseHeaderSegments(header: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < header.length) {
    if (header[i] === "[") {
      const close = header.indexOf("]", i);
      if (close < 0) break;
      const inner = header.slice(i + 1, close);

      if (inner.startsWith('"') && inner.endsWith('"')) {
        segments.push({ type: "recordKey", value: inner.slice(1, -1) });
      } else {
        segments.push({ type: "index", value: parseInt(inner, 10) });
      }
      i = close + 1;
      if (header[i] === ".") i++;
    } else {
      let dot = header.indexOf(".", i);
      let bracket = header.indexOf("[", i);
      let end: number;

      if (dot < 0 && bracket < 0) end = header.length;
      else if (dot < 0) end = bracket;
      else if (bracket < 0) end = dot;
      else end = Math.min(dot, bracket);

      const name = header.slice(i, end);
      if (name === "__TYPE__") {
        segments.push({ type: "control", value: 0 });
      } else if (name.length > 0) {
        segments.push({ type: "field", value: name });
      }

      i = end;
      if (header[i] === ".") i++;
    }
  }

  return segments;
}

export function resolveHeaderToColKey(
  header: string,
  compiled: CompiledSchema,
): string | null {
  const segments = parseHeaderSegments(header);
  const tokens: string[] = [];
  let currentNode: CompiledNode | null = compiled.root;

  for (const seg of segments) {
    if (!currentNode) return null;

    switch (seg.type) {
      case "field": {
        if (currentNode.kind !== "object") return null;
        const entry = currentNode.fields.get(seg.value as string);
        if (!entry) return null;
        tokens.push("f" + hex4(entry.fieldId));
        currentNode = entry.childNode;
        break;
      }
      case "index": {
        if (currentNode.kind !== "array") return null;
        tokens.push("i" + hex4(seg.value as number));
        currentNode = currentNode.elementNode;
        break;
      }
      case "recordKey": {
        if (currentNode.kind !== "record") return null;
        tokens.push("k" + encodeURIComponent(seg.value as string));
        currentNode = currentNode.valueNode;
        break;
      }
      case "control": {
        if (currentNode.kind !== "union") return null;
        tokens.push("c" + hex4(currentNode.controlId));
        currentNode = null;
        break;
      }
    }
  }

  return tokens.join(".");
}
