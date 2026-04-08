import type { PathToken } from "../types/internalTypes.js";

export function pushField(stack: PathToken[], fieldId: number): void {
  stack.push({ t: "f", n: fieldId });
}

export function pushIndex(stack: PathToken[], index: number): void {
  stack.push({ t: "i", n: index });
}

export function pushRecordKey(stack: PathToken[], key: string): void {
  stack.push({ t: "k", s: key });
}

export function pushControl(stack: PathToken[], controlId: number): void {
  stack.push({ t: "c", n: controlId });
}

export function pop(stack: PathToken[]): void {
  stack.pop();
}
