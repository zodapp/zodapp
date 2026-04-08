import type { UnionBranch, UnionMeta } from "../types/internalTypes.js";
import { ErrorCode } from "../errors/errorCodes.js";
import { createError } from "../errors/createError.js";

export function resolveUnion(
  controlValue: string | null | undefined,
  meta: UnionMeta,
): UnionBranch {
  if (controlValue == null) {
    throw createError(
      ErrorCode.E_INVALID_CONTROL_VALUE,
      `Control column value is missing for controlId=${meta.controlId}`,
    );
  }
  const branch = meta.branches.find((b) => b.branchId === controlValue);
  if (!branch) {
    throw createError(
      ErrorCode.E_INVALID_CONTROL_VALUE,
      `Unknown branch "${controlValue}" for controlId=${meta.controlId}. Valid: ${meta.branches.map((b) => b.branchId).join(", ")}`,
    );
  }
  return branch;
}
