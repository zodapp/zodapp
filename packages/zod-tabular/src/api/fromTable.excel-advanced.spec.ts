import { describe, it, expect } from "vitest";
import z from "zod";
import { fromTable } from "./fromTable.js";
import type { FromTableOptions } from "../types/publicTypes.js";

describe("Excel Advanced: fromTable with type-mismatched cells and converters", () => {
  describe("boolean from numeric cells (default coerce)", () => {
    const schema = z.object({ flag: z.boolean() });

    it("coerces 1/0 to true/false", () => {
      const tableData = [["flag"], [1], [0]];
      expect(fromTable(schema, tableData)).toEqual([
        { flag: true },
        { flag: false },
      ]);
    });

    it("returns undefined for non-0/1 numbers (safe default)", () => {
      const tableData = [["flag"], [42]];
      expect(fromTable(schema, tableData)).toEqual([{ flag: undefined }]);
    });
  });

  describe("boolean from string cells (Excel uppercase)", () => {
    const schema = z.object({ flag: z.boolean() });

    it("coerces 'TRUE'/'FALSE' (case-insensitive)", () => {
      const tableData = [["flag"], ["TRUE"], ["FALSE"]];
      expect(fromTable(schema, tableData)).toEqual([
        { flag: true },
        { flag: false },
      ]);
    });
  });

  describe("boolean with custom converter", () => {
    const schema = z.object({ flag: z.boolean() });
    const options: FromTableOptions = {
      booleanConverter: (v) => {
        if (v === "YES") return true;
        if (v === "NO") return false;
        return undefined;
      },
    };

    it("uses custom converter before default", () => {
      const tableData = [["flag"], ["YES"], ["NO"]];
      expect(fromTable(schema, tableData, options)).toEqual([
        { flag: true },
        { flag: false },
      ]);
    });

    it("falls back to default when converter returns undefined", () => {
      const tableData = [["flag"], [true], ["true"]];
      expect(fromTable(schema, tableData, options)).toEqual([
        { flag: true },
        { flag: true },
      ]);
    });
  });

  describe("date from numeric cells (Excel serial date)", () => {
    const EXCEL_EPOCH = new Date(1899, 11, 30).getTime();
    const msPerDay = 86400000;
    const options: FromTableOptions = {
      dateConverter: (v) => {
        if (typeof v === "number") return new Date(EXCEL_EPOCH + v * msPerDay);
        return undefined;
      },
    };
    const schema = z.object({ dueDate: z.date() });

    it("converts Excel serial number to Date via converter", () => {
      const serial = 45671;
      const tableData = [["dueDate"], [serial]];
      const expected = [{ dueDate: new Date(EXCEL_EPOCH + serial * msPerDay) }];
      expect(fromTable(schema, tableData, options)).toEqual(expected);
    });

    it("still handles native Date when converter is present", () => {
      const d = new Date("2025-06-01T00:00:00.000Z");
      const tableData = [["dueDate"], [d]];
      expect(fromTable(schema, tableData, options)).toEqual([{ dueDate: d }]);
    });
  });

  describe("date from numeric cells (no converter)", () => {
    const schema = z.object({ dueDate: z.date() });

    it("returns undefined for number without converter (safe default)", () => {
      const tableData = [["dueDate"], [45671]];
      expect(fromTable(schema, tableData)).toEqual([{ dueDate: undefined }]);
    });
  });

  describe("number from string cells", () => {
    const schema = z.object({ val: z.number() });

    it("coerces string to number (default)", () => {
      const tableData = [["val"], ["42"], ["3.14"]];
      expect(fromTable(schema, tableData)).toEqual([
        { val: 42 },
        { val: 3.14 },
      ]);
    });
  });

  describe("number with custom converter", () => {
    const schema = z.object({ amount: z.number() });
    const options: FromTableOptions = {
      numberConverter: (v) => {
        if (typeof v === "string" && v.endsWith("円")) {
          return Number(v.replace("円", ""));
        }
        return undefined;
      },
    };

    it("parses locale-specific format via converter, falls back for plain string", () => {
      const tableData = [["amount"], ["1500円"], ["99"]];
      expect(fromTable(schema, tableData, options)).toEqual([
        { amount: 1500 },
        { amount: 99 },
      ]);
    });
  });

  describe("bigint with custom converter", () => {
    const schema = z.object({ id: z.bigint() });
    const options: FromTableOptions = {
      bigintConverter: (v) => {
        if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
        return undefined;
      },
    };

    it("converts integer number to bigint via converter", () => {
      const tableData = [["id"], [12345]];
      expect(fromTable(schema, tableData, options)).toEqual([{ id: 12345n }]);
    });
  });

  describe("string coercion from number", () => {
    const schema = z.object({ label: z.string() });

    it("coerces number to string for z.string()", () => {
      const tableData = [["label"], [123]];
      expect(fromTable(schema, tableData)).toEqual([{ label: "123" }]);
    });
  });
});
