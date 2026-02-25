import { describe, it, expect } from "vitest";
import z from "zod";
import { toStringTable } from "./toStringTable.js";
import { fromStringTable } from "./fromStringTable.js";

describe("toStringTable / fromStringTable round-trip", () => {
  describe("flat object", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const rawData = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const tableData = [
      ["name", "age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips with type restoration", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("nested object", () => {
    const schema = z.object({
      user: z.object({ first: z.string(), last: z.string() }),
      score: z.number(),
    });
    const rawData = [
      { user: { first: "Taro", last: "Yamada" }, score: 100 },
    ];
    const tableData = [
      ["user.first", "user.last", "score"],
      ["Taro", "Yamada", "100"],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips nested structure", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("array field", () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const rawData = [
      { tags: ["a", "b", "c"] },
      { tags: ["x"] },
    ];
    const tableData = [
      ["tags[0]", "tags[1]", "tags[2]"],
      ["a", "b", "c"],
      ["x", "", ""],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips array", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored[0]!.tags).toEqual(["a", "b", "c"]);
      expect(restored[1]!.tags[0]).toBe("x");
    });

    it("handles empty array (header-only output)", () => {
      const table = toStringTable(schema, [{ tags: [] }]);
      expect(table.length).toBe(2);
    });
  });

  describe("array of objects", () => {
    const schema = z.object({
      items: z.array(z.object({ id: z.number(), label: z.string() })),
    });
    const rawData = [
      { items: [{ id: 1, label: "one" }, { id: 2, label: "two" }] },
    ];
    const tableData = [
      ["items[0].id", "items[0].label", "items[1].id", "items[1].label"],
      ["1", "one", "2", "two"],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips array of objects", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored[0]!.items).toEqual(rawData[0]!.items);
    });
  });

  describe("record field", () => {
    const schema = z.object({ meta: z.record(z.string(), z.string()) });
    const rawData = [{ meta: { baz: "qux", foo: "bar" } }];

    it("round-trips record keys", () => {
      const table = toStringTable(schema, rawData);
      const restored = fromStringTable(schema, table);
      expect(restored[0]!.meta.foo).toBe("bar");
      expect(restored[0]!.meta.baz).toBe("qux");
    });
  });

  describe("optional / nullable fields", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
    });
    const rawData = [
      { required: "yes", optional: undefined, nullable: null },
    ];
    const tableData = [
      ["required", "optional", "nullable"],
      ["yes", "", ""],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips with empty string for missing values (not fully reversible)", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored[0]!.required).toBe("yes");
      expect(restored[0]!.optional).toBe("");
      expect(restored[0]!.nullable).toBe("");
    });
  });

  describe("boolean field", () => {
    const schema = z.object({ active: z.boolean() });
    const rawData = [{ active: true }, { active: false }];
    const tableData = [
      ["active"],
      ["true"],
      ["false"],
    ];

    it("produces correct table", () => {
      const table = toStringTable(schema, rawData);
      expect(table).toEqual(tableData);
    });

    it("round-trips booleans with type restoration", () => {
      const restored = fromStringTable(schema, tableData);
      expect(restored).toEqual(rawData);
    });
  });

  describe("empty input", () => {
    const schema = z.object({ x: z.string() });

    it("returns header-only table for empty rows", () => {
      const table = toStringTable(schema, []);
      expect(table.length).toBe(1);
    });

    it("returns empty array for empty table", () => {
      expect(fromStringTable(schema, [])).toEqual([]);
    });
  });
});
