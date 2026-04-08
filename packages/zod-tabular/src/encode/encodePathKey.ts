import type { PathToken } from "../types/internalTypes.js";

function hex4(n: number): string {
  return n.toString(16).padStart(4, "0");
}

function encodeToken(token: PathToken): string {
  if (token.t === "k") {
    return "k" + encodeURIComponent(token.s);
  }
  return token.t + hex4(token.n);
}

export function encodePathKey(stack: readonly PathToken[]): string {
  return stack.map(encodeToken).join(".");
}
