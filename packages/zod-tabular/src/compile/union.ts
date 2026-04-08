import z from "zod";
import { unwrap } from "./unwrap.js";
import { ErrorCode } from "../errors/errorCodes.js";
import { createError } from "../errors/createError.js";
import type { UnionMeta, UnionBranch, CompiledNode } from "../types/internalTypes.js";

export function buildUnionMeta(
  options: z.ZodType[],
  controlId: number,
  compileNode: (schema: z.ZodType) => CompiledNode,
): UnionMeta {
  const seen = new Map<string, number>();
  const branches: UnionBranch[] = [];

  for (let i = 0; i < options.length; i++) {
    const raw = options[i]!;
    const base = unwrap(raw);
    const typeName = base._zod.def.type;

    if (seen.has(typeName)) {
      const msg =
        typeName === "object"
          ? `Union branch type "${typeName}" duplicated at indices ${seen.get(typeName)} and ${i}. Use discriminatedUnion instead.`
          : `Union branch type "${typeName}" duplicated at indices ${seen.get(typeName)} and ${i}.`;
      throw createError(ErrorCode.E_UNION_TYPE_COLLISION, msg);
    }
    seen.set(typeName, i);

    branches.push({
      branchId: typeName,
      node: compileNode(raw),
    });
  }

  return { controlId, branches };
}
