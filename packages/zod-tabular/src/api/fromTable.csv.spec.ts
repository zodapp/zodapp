import { describe, it, expect } from "vitest";
import z from "zod";
import { fromTable } from "./fromTable.js";

describe("CSV: fromTable restores typed values from string-only input", () => {
  describe("flat object", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const tableData = [
      ["name", "age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ];
    const expected = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    it("restores number from string", () => {
      expect(fromTable(schema, tableData)).toEqual(expected);
    });
  });

  describe("nested object from strings", () => {
    const schema = z.object({
      user: z.object({ first: z.string(), last: z.string() }),
      score: z.number(),
    });
    const tableData = [
      ["user.first", "user.last", "score"],
      ["Taro", "Yamada", "100"],
    ];
    const expected = [
      { user: { first: "Taro", last: "Yamada" }, score: 100 },
    ];

    it("restores nested structure", () => {
      expect(fromTable(schema, tableData)).toEqual(expected);
    });
  });

  describe("array field from strings", () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const tableData = [
      ["tags[0]", "tags[1]", "tags[2]"],
      ["a", "b", "c"],
      ["x", "", ""],
    ];

    it("restores string array", () => {
      const restored = fromTable(schema, tableData);
      expect(restored[0]).toEqual({ tags: ["a", "b", "c"] });
      expect(restored[1]!.tags[0]).toBe("x");
    });
  });

  describe("boolean field from strings", () => {
    const schema = z.object({ active: z.boolean() });

    it("restores 'true'/'false' strings to boolean", () => {
      const tableData = [["active"], ["true"], ["false"]];
      expect(fromTable(schema, tableData)).toEqual([
        { active: true },
        { active: false },
      ]);
    });

    it("restores '1'/'0' strings to boolean", () => {
      const tableData = [["active"], ["1"], ["0"]];
      expect(fromTable(schema, tableData)).toEqual([
        { active: true },
        { active: false },
      ]);
    });

    it("returns undefined for ambiguous string that cannot be coerced", () => {
      const tableData = [["active"], ["yes"]];
      expect(fromTable(schema, tableData)).toEqual([{ active: undefined }]);
    });
  });

  describe("date field from ISO string", () => {
    const schema = z.object({ createdAt: z.date() });
    const tableData = [["createdAt"], ["2025-01-15T00:00:00.000Z"]];
    const expected = [{ createdAt: new Date("2025-01-15T00:00:00.000Z") }];

    it("restores ISO date string to Date", () => {
      expect(fromTable(schema, tableData)).toEqual(expected);
    });
  });

  describe("optional / nullable from empty string", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
    });
    const tableData = [
      ["required", "optional", "nullable"],
      ["yes", "", ""],
    ];
    const expected = [
      { required: "yes", optional: undefined, nullable: null },
    ];

    it("handles empty strings for optional/nullable", () => {
      expect(fromTable(schema, tableData)).toEqual(expected);
    });
  });

  describe("record from strings", () => {
    const schema = z.object({ meta: z.record(z.string(), z.string()) });
    const tableData = [
      ['meta["foo"]', 'meta["baz"]'],
      ["bar", "qux"],
    ];
    const expected = [{ meta: { baz: "qux", foo: "bar" } }];

    it("restores record keys from string table", () => {
      expect(fromTable(schema, tableData)).toEqual(expected);
    });
  });

  describe("empty input", () => {
    const schema = z.object({ x: z.string() });

    it("returns empty array for empty table", () => {
      expect(fromTable(schema, [])).toEqual([]);
    });
  });
});
