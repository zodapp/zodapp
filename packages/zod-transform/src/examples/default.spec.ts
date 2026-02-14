import { describe, expect, it } from "vitest";
import z from "zod";

import { getDefaultValue } from "./default";

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === "object" && v !== null && !Array.isArray(v);
};

/**
 * getDefaultValue() は transform 内部で null-proto object を返すことがあるため、
 * 比較を安定させる目的でプレーンな object/array に正規化する。
 */
const toPlain = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(toPlain);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
};

describe("getDefaultValue", () => {
  it("z.object の深い階層にある default() を収集してデフォルト値を構築できる", () => {
    const schema = z.object({
      user: z.object({
        name: z.string().default("名無し"),
        age: z.number().default(20),
        flags: z.object({
          admin: z.boolean().default(false),
        }),
      }),
      settings: z.object({
        theme: z.enum(["light", "dark"]).default("light"),
      }),
    });

    expect(toPlain(getDefaultValue(schema))).toEqual({
      user: {
        name: "名無し",
        age: 20,
        flags: {
          admin: false,
        },
      },
      settings: {
        theme: "light",
      },
    });
  });

  it("z.array(...).min(n) の場合、要素スキーマの default() も収集できる", () => {
    const schema = z.object({
      items: z
        .array(
          z.object({
            id: z.string().default(""),
            qty: z.number().default(1),
          }),
        )
        .min(2),
    });

    expect(toPlain(getDefaultValue(schema))).toEqual({
      items: [
        { id: "", qty: 1 },
        { id: "", qty: 1 },
      ],
    });
  });

  it("z.array(...).length(n) の場合、array/tuple の深い階層でも default() を収集できる", () => {
    const schema = z.object({
      matrix: z
        .array(z.tuple([z.string().default("x"), z.number().default(0)]))
        .length(3),
    });

    expect(toPlain(getDefaultValue(schema))).toEqual({
      matrix: [
        ["x", 0],
        ["x", 0],
        ["x", 0],
      ],
    });
  });

  it("z.tuple の各要素に対して default() を収集できる（途中に object があってもOK）", () => {
    const schema = z.tuple([
      z.string().default("first"),
      z.object({
        nested: z.number().default(99),
      }),
    ]);

    expect(toPlain(getDefaultValue(schema))).toEqual(["first", { nested: 99 }]);
  });

  it("default が無い optional / nullable でも安全に補完できる（parse も通る）", () => {
    const schema = z.object({
      a: z.string().optional(),
      b: z.string().nullable(),
      c: z.string().optional().nullable(),
      d: z.string().nullable().optional(),
    });

    const value = getDefaultValue(schema);
    expect(toPlain(value)).toEqual({
      a: undefined,
      b: null,
      c: null,
      d: undefined,
    });

    const parsed = schema.safeParse(value);
    expect(parsed.success).toBe(true);
  });

  it("z.string().optional().nullable() / z.string().nullable().optional() を安全に扱える（外側のラッパーに従う）", () => {
    const schema1 = z.string().optional().nullable();
    const value1 = getDefaultValue(schema1);
    expect(value1).toBeNull();
    expect(schema1.safeParse(value1).success).toBe(true);

    const schema2 = z.string().nullable().optional();
    const value2 = getDefaultValue(schema2);
    expect(value2).toBeUndefined();
    expect(schema2.safeParse(value2).success).toBe(true);
  });

  it("default / optional / nullable が無い場合は parse を通らない（ただし getDefaultValue 自体は throw しない）", () => {
    const schema = z.object({
      required: z.string(),
    });

    expect(() => getDefaultValue(schema)).not.toThrow();
    const value = getDefaultValue(schema);
    expect(toPlain(value)).toEqual({ required: undefined });
    expect(schema.safeParse(value).success).toBe(false);
  });
});
