import type { CompiledSchema } from "../types/internalTypes.js";
import { CONTROL_HEADER } from "../types/internalTypes.js";

interface ParsedToken {
  type: "f" | "i" | "k" | "c";
  raw: string;
}

function parseToken(token: string): ParsedToken {
  const prefix = token[0] as "f" | "i" | "k" | "c";
  return { type: prefix, raw: token.slice(1) };
}

export function decodeHeader(
  colKey: string,
  compiled: CompiledSchema,
): string {
  const tokens = colKey.split(".");
  const parts: string[] = [];

  for (const tok of tokens) {
    const parsed = parseToken(tok);
    switch (parsed.type) {
      case "f": {
        const id = parseInt(parsed.raw, 16);
        const name = compiled.fieldIdToName.get(id);
        parts.push(name ?? `field_${parsed.raw}`);
        break;
      }
      case "i": {
        const index = parseInt(parsed.raw, 16);
        const prev = parts.pop();
        parts.push(`${prev ?? ""}[${index}]`);
        break;
      }
      case "k": {
        const key = decodeURIComponent(parsed.raw);
        const prev = parts.pop();
        parts.push(`${prev ?? ""}["${key}"]`);
        break;
      }
      case "c": {
        parts.push(CONTROL_HEADER);
        break;
      }
    }
  }

  return parts.join(".");
}

export function decodeHeaders(
  sortedKeys: string[],
  compiled: CompiledSchema,
): string[] {
  return sortedKeys.map((key) => decodeHeader(key, compiled));
}
