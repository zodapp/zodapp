import { describe, it, expect } from "vitest";
import z from "zod";
import { toTypedTable } from "./toTypedTable.js";
import { fromTypedTable } from "./fromTypedTable.js";

describe("toTypedTable / fromTypedTable round-trip", () => {
  describe("flat object with mixed types", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });
    const rawData = [
      { name: "Alice", age: 30, active: true },
      { name: "Bob", age: 25, active: false },
    ];
    const tableData = [
      ["name", "age", "active"],
      ["Alice", 30, true],
      ["Bob", 25, false],
    ];

    it("produces correct table", () => {
      const table = toTypedTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips with type preservation", () => {
      const restored = fromTypedTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("nested object", () => {
    const schema = z.object({
      user: z.object({ name: z.string() }),
      score: z.number(),
    });
    const rawData = [{ user: { name: "Taro" }, score: 95 }];
    const tableData = [
      ["user.name", "score"],
      ["Taro", 95],
    ];

    it("produces correct table", () => {
      const table = toTypedTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips preserving nested structure and types", () => {
      const restored = fromTypedTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("array of primitives", () => {
    const schema = z.object({ values: z.array(z.number()) });
    const rawData = [{ values: [10, 20, 30] }];
    const tableData = [
      ["values[0]", "values[1]", "values[2]"],
      [10, 20, 30],
    ];

    it("produces correct table", () => {
      const table = toTypedTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips numeric array", () => {
      const restored = fromTypedTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("record with number values", () => {
    const schema = z.object({ scores: z.record(z.string(), z.number()) });
    const rawData = [{ scores: { math: 90, eng: 85 } }];

    it("round-trips record with typed values", () => {
      const table = toTypedTable(schema, rawData);
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.scores.math).toBe(90);
      expect(restored[0]!.scores.eng).toBe(85);
    });
  });

  describe("nullable field", () => {
    const schema = z.object({ value: z.string().nullable() });
    const rawData = [{ value: null }, { value: "hello" }];
    const tableData = [
      ["value"],
      [null],
      ["hello"],
    ];

    it("produces correct table", () => {
      const table = toTypedTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips preserving null", () => {
      const restored = fromTypedTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("date field", () => {
    const schema = z.object({ createdAt: z.date() });
    const d = new Date("2025-01-15T00:00:00.000Z");
    const rawData = [{ createdAt: d }];
    const tableData = [["createdAt"], [d]];

    it("produces correct table", () => {
      const table = toTypedTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips preserving Date", () => {
      const restored = fromTypedTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("fromTypedTable coercion of irregular input", () => {
    it("coerces string '42' to number 42", () => {
      const schema = z.object({ val: z.number() });
      const table = [["val"], ["42"]];
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.val).toBe(42);
    });

    it("coerces string 'true' to boolean true", () => {
      const schema = z.object({ flag: z.boolean() });
      const table = [["flag"], ["true"]];
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.flag).toBe(true);
    });

    it("coerces string 'false' to boolean false", () => {
      const schema = z.object({ flag: z.boolean() });
      const table = [["flag"], ["false"]];
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.flag).toBe(false);
    });

    it("coerces string '1' to boolean true for z.boolean()", () => {
      const schema = z.object({ flag: z.boolean() });
      const table = [["flag"], ["1"]];
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.flag).toBe(true);
    });

    it("coerces number to string for z.string()", () => {
      const schema = z.object({ label: z.string() });
      const table = [["label"], [123]];
      const restored = fromTypedTable(schema, table);
      expect(restored[0]!.label).toBe("123");
    });
  });

  describe("empty input", () => {
    const schema = z.object({ x: z.number() });

    it("returns header-only for empty rows", () => {
      const table = toTypedTable(schema, []);
      expect(table.length).toBe(1);
    });

    it("returns empty array for empty table", () => {
      expect(fromTypedTable(schema, [])).toEqual([]);
    });
  });
});
