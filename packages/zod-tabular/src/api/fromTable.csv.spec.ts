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
      expect(restored[1]).toEqual({ tags: ["x"] });
    });
  });

  describe("blank nested structures", () => {
    const periodSchema = z.object({
      day: z.number(),
      start: z.number(),
      end: z.number(),
    });

    it("treats an optional array of objects as missing when every descendant cell is blank", () => {
      const schema = z.object({
        name: z.string(),
        schedule: z.array(periodSchema).optional(),
      });
      const tableData = [
        [
          "name",
          "schedule[0].day",
          "schedule[0].start",
          "schedule[0].end",
          "schedule[1].day",
          "schedule[1].start",
          "schedule[1].end",
        ],
        ["line", "", "", "", "", "", ""],
      ];

      expect(fromTable(schema, tableData)).toEqual([
        { name: "line", schedule: undefined },
      ]);
    });

    it("prunes trailing blank array elements", () => {
      const schema = z.object({ values: z.array(z.number()) });
      const tableData = [
        ["values[0]", "values[1]", "values[2]"],
        ["10", "", ""],
      ];

      expect(fromTable(schema, tableData)).toEqual([{ values: [10] }]);
    });

    it("keeps partially filled array object elements invalid", () => {
      const schema = z.object({
        schedule: z.array(periodSchema).optional(),
      });
      const tableData = [
        ["schedule[0].day", "schedule[0].start", "schedule[0].end"],
        ["1", "", "10"],
      ];

      expect(fromTable(schema, tableData)).toEqual([]);
    });

    it("keeps zero and false as non-blank nested values", () => {
      const schema = z.object({
        meta: z.object({
          count: z.number(),
          active: z.boolean(),
        }).optional(),
      });
      const tableData = [
        ["meta.count", "meta.active"],
        ["0", "false"],
      ];

      expect(fromTable(schema, tableData)).toEqual([
        { meta: { count: 0, active: false } },
      ]);
    });

    it("treats an optional nested object as missing when all string cells are blank", () => {
      const schema = z.object({
        name: z.string(),
        user: z.object({
          first: z.string(),
          last: z.string(),
        }).optional(),
      });
      const tableData = [
        ["name", "user.first", "user.last"],
        ["row", "", ""],
      ];

      expect(fromTable(schema, tableData)).toEqual([
        { name: "row", user: undefined },
      ]);
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

    it("skips row when ambiguous string cannot be coerced", () => {
      const tableData = [["active"], ["yes"]];
      expect(fromTable(schema, tableData)).toEqual([]);
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
