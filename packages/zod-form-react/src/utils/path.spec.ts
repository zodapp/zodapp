import { describe, expect, it } from "vitest";
import { isUnsafeFieldKey } from "./path";

describe("isUnsafeFieldKey", () => {
  it.each(["", "a.b", "a[0]", "]", "["])("%j は使えない", (key) => {
    expect(isUnsafeFieldKey(key)).toBe(true);
  });
  it.each(["a", "1", "名前", "a-b", "a b"])("%j は使える", (key) => {
    expect(isUnsafeFieldKey(key)).toBe(false);
  });
});
