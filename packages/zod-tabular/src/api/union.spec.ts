import { describe, it, expect } from "vitest";
import z from "zod";
import { toTable } from "./toTable.js";
import { fromTable } from "./fromTable.js";
import { compileSchema } from "../compile/compileSchema.js";
import { TabularError } from "../errors/createError.js";
import { ErrorCode } from "../errors/errorCodes.js";

describe("union handling", () => {
  describe("primitive union (string | number)", () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });
    const rawData = [{ value: 42 }, { value: "text" }];

    it("round-trips preserving type", () => {
      const table = toTable(schema, rawData);
      expect(fromTable(schema, table)).toEqual(rawData);
    });

    it("includes __TYPE__ control header", () => {
      const table = toTable(schema, [{ value: "hello" }]);
      expect(table[0]!.some((h) => String(h).includes("__TYPE__"))).toBe(true);
      expect(fromTable(schema, table)).toEqual([{ value: "hello" }]);
    });
  });

  describe("primitive union (string | boolean)", () => {
    const schema = z.object({
      flag: z.union([z.string(), z.boolean()]),
    });
    const rawData = [{ flag: true }, { flag: "yes" }];

    it("round-trips distinguishing string from boolean", () => {
      const table = toTable(schema, rawData);
      expect(fromTable(schema, table)).toEqual(rawData);
    });
  });

  describe("ZodType.type collision -> compile error", () => {
    it("throws E_UNION_TYPE_COLLISION for string | string", () => {
      const schema = z.object({
        val: z.union([z.string(), z.string()]),
      });
      expect(() => compileSchema(schema)).toThrow(TabularError);
      try {
        compileSchema(schema);
      } catch (e) {
        expect((e as TabularError).code).toBe(ErrorCode.E_UNION_TYPE_COLLISION);
      }
    });

    it("throws E_UNION_TYPE_COLLISION for object | object", () => {
      const schema = z.object({
        val: z.union([
          z.object({ a: z.string() }),
          z.object({ b: z.number() }),
        ]),
      });
      expect(() => compileSchema(schema)).toThrow(TabularError);
      try {
        compileSchema(schema);
      } catch (e) {
        expect((e as TabularError).code).toBe(ErrorCode.E_UNION_TYPE_COLLISION);
        expect((e as TabularError).message).toContain("discriminatedUnion");
      }
    });
  });

  describe("discriminatedUnion", () => {
    const schema = z.object({
      payload: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("text"), text: z.string() }),
        z.object({ kind: z.literal("num"), num: z.number() }),
      ]),
    });
    const rawData = [
      { payload: { kind: "text" as const, text: "hello" } },
      { payload: { kind: "num" as const, num: 42 } },
    ];

    it("round-trips discriminated union branches", () => {
      const table = toTable(schema, rawData);
      const restored = fromTable(schema, table);
      expect(restored).toEqual([
        { payload: { kind: "text", text: "hello" } },
        { payload: { kind: "num", num: 42 } },
      ]);
    });
  });
});

describe("intersection handling", () => {
  describe("object & object intersection", () => {
    const left = z.object({ a: z.string(), b: z.number() });
    const right = z.object({ c: z.boolean() });
    const schema = z.intersection(left, right);
    const rawData = [
      { a: "hello", b: 1, c: true },
      { a: "world", b: 2, c: false },
    ];

    it("round-trips object-object intersection", () => {
      const table = toTable(schema, rawData);
      expect(table[0]).toHaveLength(3);
      expect(fromTable(schema, table)).toEqual(rawData);
    });

    it("produces correct headers for merged fields", () => {
      const table = toTable(schema, rawData);
      const headers = table[0]!.map(String);
      expect(headers).toContain("a");
      expect(headers).toContain("b");
      expect(headers).toContain("c");
    });
  });

  describe("nested object & object intersection", () => {
    const schema = z.object({
      info: z.intersection(
        z.object({ name: z.string() }),
        z.object({ age: z.number() }),
      ),
    });
    const rawData = [{ info: { name: "Alice", age: 30 } }];

    it("round-trips nested intersection", () => {
      const table = toTable(schema, rawData);
      expect(fromTable(schema, table)).toEqual(rawData);
    });
  });

  describe("top-level intersection with overlapping keys", () => {
    const left = z.object({ x: z.string(), shared: z.string() });
    const right = z.object({ y: z.number(), shared: z.string() });
    const schema = z.intersection(left, right);
    const rawData = [{ x: "a", y: 1, shared: "common" }];

    it("deduplicates overlapping keys (left wins)", () => {
      const table = toTable(schema, rawData);
      const headers = table[0]!.map(String);
      const sharedCount = headers.filter((h) => h === "shared").length;
      expect(sharedCount).toBe(1);
      expect(fromTable(schema, table)).toEqual(rawData);
    });
  });
});
