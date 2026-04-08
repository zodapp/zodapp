import { describe, it, expect } from "vitest";
import z from "zod";
import { toTable } from "./toTable.js";
import { fromTable } from "./fromTable.js";

describe("Excel basic: toTable -> fromTable round-trip", () => {
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
      expect(toTable(schema, rawData)).toEqual(tableData);
    });

    it("round-trips with type preservation", () => {
      expect(fromTable(schema, tableData)).toEqual(rawData);
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
      expect(toTable(schema, rawData)).toEqual(tableData);
    });

    it("round-trips preserving nested structure", () => {
      expect(fromTable(schema, tableData)).toEqual(rawData);
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
      expect(toTable(schema, rawData)).toEqual(tableData);
    });

    it("round-trips numeric array", () => {
      expect(fromTable(schema, tableData)).toEqual(rawData);
    });
  });

  describe("record with number values", () => {
    const schema = z.object({ scores: z.record(z.string(), z.number()) });
    const rawData = [{ scores: { eng: 85, math: 90 } }];

    it("round-trips record", () => {
      const table = toTable(schema, rawData);
      expect(fromTable(schema, table)).toEqual(rawData);
    });
  });

  describe("nullable field", () => {
    const schema = z.object({ value: z.string().nullable() });
    const rawData = [{ value: null }, { value: "hello" }];
    const tableData = [["value"], [null], ["hello"]];

    it("produces correct table", () => {
      expect(toTable(schema, rawData)).toEqual(tableData);
    });

    it("round-trips preserving null", () => {
      expect(fromTable(schema, tableData)).toEqual(rawData);
    });
  });

  describe("date field", () => {
    const schema = z.object({ createdAt: z.date() });
    const d = new Date("2025-01-15T00:00:00.000Z");
    const rawData = [{ createdAt: d }];
    const tableData = [["createdAt"], [d]];

    it("produces correct table", () => {
      expect(toTable(schema, rawData)).toEqual(tableData);
    });

    it("round-trips preserving Date", () => {
      expect(fromTable(schema, tableData)).toEqual(rawData);
    });
  });

  describe("empty input", () => {
    const schema = z.object({ x: z.number() });

    it("returns header-only for empty rows", () => {
      const table = toTable(schema, []);
      expect(table.length).toBe(1);
    });

    it("returns empty array for empty table", () => {
      expect(fromTable(schema, [])).toEqual([]);
    });
  });
});
