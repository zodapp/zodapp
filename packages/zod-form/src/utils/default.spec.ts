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

  it("uses null for nullable-only fields and undefined when both optional and nullable", () => {
    const schema = z.object({
      nullableOnly: z.string().nullable(),
      optionalThenNullable: z.string().optional().nullable(),
      nullableThenOptional: z.string().nullable().optional(),
      nullableObject: z.object({ x: z.string() }).nullable(),
    });

    expect(getDefaultValue(schema)).toEqual({
      nullableOnly: null,
      optionalThenNullable: undefined,
      nullableThenOptional: undefined,
      nullableObject: null,
    });
    const value = getDefaultValue(schema) as Record<string, unknown>;
    expect("optionalThenNullable" in value).toBe(true);
  });
});
