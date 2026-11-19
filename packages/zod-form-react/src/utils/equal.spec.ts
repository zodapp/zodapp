import { describe, expect, it } from "vitest";
import { isEqualValue } from "./equal";

describe("isEqualValue", () => {
  it("Set は中身で比べ、順序は見ない", () => {
    expect(isEqualValue(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(isEqualValue(new Set(["a"]), new Set(["b"]))).toBe(false);
    expect(isEqualValue(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
    expect(isEqualValue(new Set(), {})).toBe(false);
  });

  it("Map はキーと値で比べる", () => {
    expect(
      isEqualValue(new Map([["a", { x: 1 }]]), new Map([["a", { x: 1 }]])),
    ).toBe(true);
    expect(isEqualValue(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
  });

  it("object の中の Set も比べる", () => {
    expect(isEqualValue({ s: new Set([1]) }, { s: new Set([2]) })).toBe(false);
  });
});
