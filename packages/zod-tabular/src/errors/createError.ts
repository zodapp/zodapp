import type { ErrorCode } from "./errorCodes.js";

export class TabularError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = "TabularError";
  }
}

export function createError(code: ErrorCode, message: string): TabularError {
  return new TabularError(code, message);
}
