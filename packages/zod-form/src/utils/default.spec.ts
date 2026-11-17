import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getDefaultValue } from "./default";

describe("getDefaultValue", () => {
  it("does not choose a union branch by filling literal values from undefined", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({
        type: z.literal("first"),
        label: z.string(),
      }),
      z.object({
        type: z.literal("second"),
        count: z.number(),
      }),
    ]);

    expect(getDefaultValue(schema)).toBeUndefined();
  });

  it("keeps explicit undefined union branches", () => {
    const schema = z.union([
      z.object({
        type: z.literal("configured"),
        label: z.string(),
      }),
      z.undefined(),
    ]);

    expect(getDefaultValue(schema)).toBeUndefined();
  });

  it("keeps explicit default union branches", () => {
    const schema = z.union([z.string().default("fallback"), z.number()]);

    expect(getDefaultValue(schema)).toBe("fallback");
  });

  it("keeps literal defaults after a branch is already selected", () => {
    const schema = z.object({
      type: z.literal("selected"),
      label: z.string(),
    });

    expect(getDefaultValue(schema)).toEqual({
      type: "selected",
      label: undefined,
    });
  });

  describe("nullable と default・optional の重なり（zod と同じ値にする）", () => {
    it.each([
      ["default の外に nullable", z.string().default("x").nullable(), "x"],
      ["nullable の外に default", z.string().nullable().default("x"), "x"],
      ["nullable だけ", z.string().nullable(), null],
      ["optional だけ", z.string().optional(), undefined],
      ["optional の外に nullable", z.string().optional().nullable(), undefined],
      ["nullable の外に optional", z.string().nullable().optional(), undefined],
    ])("%s", (_, schema, expected) => {
      expect(getDefaultValue(schema)).toBe(expected);
    });

    it("object の中でも、nullable の中の default を使う", () => {
      const schema = z.object({
        a: z.string().default("x").nullable(),
        b: z.string().nullable(),
      });
      expect(getDefaultValue(schema)).toEqual({ a: "x", b: null });
    });
  });
});
