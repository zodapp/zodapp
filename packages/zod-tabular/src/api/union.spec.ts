import { describe, it, expect } from "vitest";
import z from "zod";
import { toStringTable } from "./toStringTable.js";
import { fromStringTable } from "./fromStringTable.js";
import { toTypedTable } from "./toTypedTable.js";
import { fromTypedTable } from "./fromTypedTable.js";
import { compileSchema } from "../compile/compileSchema.js";
import { TabularError } from "../errors/createError.js";
import { ErrorCode } from "../errors/errorCodes.js";

describe("union handling", () => {
  describe("primitive union (string | number)", () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    it("string table: round-trips string branch", () => {
      const rawData = [{ value: "hello" }];
      const table = toStringTable(schema, rawData);

      expect(table[0]!.some((h) => h.includes("__TYPE__"))).toBe(true);

      const restored = fromStringTable(schema, table);
      expect(restored[0]!.value).toBe("hello");
    });

    it("typed table: round-trips preserving type", () => {
      const rawData = [{ value: 42 }, { value: "text" }];
      const table = toTypedTable(schema, rawData);
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.value).toBe(42);
      expect(restored[1]!.value).toBe("text");
    });
  });

  describe("primitive union (string | boolean)", () => {
    const schema = z.object({
      flag: z.union([z.string(), z.boolean()]),
    });

    it("typed table: distinguishes string from boolean", () => {
      const rawData = [{ flag: true }, { flag: "yes" }];
      const table = toTypedTable(schema, rawData);
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.flag).toBe(true);
      expect(restored[1]!.flag).toBe("yes");
    });
  });

  describe("ZodType.type collision → compile error", () => {
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

    it("typed table: round-trips discriminated union branches", () => {
      const table = toTypedTable(schema, rawData);
      const restored = fromTypedTable(schema, table);

      const r0 = restored[0]!.payload as { kind: string; text?: string };
      const r1 = restored[1]!.payload as { kind: string; num?: number };
      expect(r0.kind).toBe("text");
      expect(r0.text).toBe("hello");
      expect(r1.kind).toBe("num");
      expect(r1.num).toBe(42);
    });
  });
});
