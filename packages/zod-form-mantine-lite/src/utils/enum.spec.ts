import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { toEnumOptionValue, fromEnumOptionValue } from "./enum";

describe("enum option value", () => {
  const numberEnum = zf.enum([z.literal(0), z.literal(0.5)]);
  const stringEnum = zf.enum([z.literal("a"), z.literal("b")]);

  it("toEnumOptionValue は値を文字列にし、未選択を null にする (0 は残す)", () => {
    expect(toEnumOptionValue(0)).toBe("0");
    expect(toEnumOptionValue(0.5)).toBe("0.5");
    expect(toEnumOptionValue("a")).toBe("a");
    expect(toEnumOptionValue(undefined)).toBeNull();
    expect(toEnumOptionValue(null)).toBeNull();
    expect(toEnumOptionValue("")).toBeNull();
  });

  it("fromEnumOptionValue は選択肢の元の値 (数値) に戻す", () => {
    expect(fromEnumOptionValue(numberEnum, "0")).toBe(0);
    expect(fromEnumOptionValue(numberEnum, "0.5")).toBe(0.5);
    expect(fromEnumOptionValue(stringEnum, "b")).toBe("b");
    expect(fromEnumOptionValue(numberEnum, null)).toBeUndefined();
    expect(fromEnumOptionValue(numberEnum, "")).toBeUndefined();
  });
});
