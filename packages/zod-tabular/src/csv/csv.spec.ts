import { describe, it, expect } from "vitest";
import { tableToCsv, csvToTable } from "./csv.js";
import type { Table } from "../types/publicTypes.js";

describe("tableToCsv", () => {
  it("converts a basic table with BOM, CRLF, and Excel formatting", () => {
    const table: Table = [
      ["name", "age", "active"],
      ["Alice", 30, true],
      ["Bob", 25, false],
    ];
    const csv = tableToCsv(table);
    expect(csv).toBe(
      "\uFEFF" +
        "name,age,active\r\n" +
        "Alice,30,TRUE\r\n" +
        "Bob,25,FALSE\r\n",
    );
  });

  it("formats Date as YYYY-MM-DD HH:mm:ss", () => {
    const d = new Date(2025, 0, 15, 9, 30, 0);
    const table: Table = [["createdAt"], [d]];
    const csv = tableToCsv(table);
    expect(csv).toBe("\uFEFFcreatedAt\r\n2025-01-15 09:30:00\r\n");
  });

  it("formats null as empty string", () => {
    const table: Table = [["value"], [null]];
    const csv = tableToCsv(table);
    expect(csv).toBe("\uFEFFvalue\r\n\r\n");
  });

  it("escapes fields containing commas, quotes, and newlines", () => {
    const table: Table = [
      ["desc"],
      ['hello, "world"'],
      ["line1\nline2"],
    ];
    const csv = tableToCsv(table);
    expect(csv).toBe(
      "\uFEFF" +
        "desc\r\n" +
        '"hello, ""world"""\r\n' +
        '"line1\nline2"\r\n',
    );
  });
});

describe("csvToTable", () => {
  it("parses BOM + CRLF CSV into string table", () => {
    const csv =
      "\uFEFF" +
      "name,age,active\r\n" +
      "Alice,30,TRUE\r\n" +
      "Bob,25,FALSE\r\n";
    expect(csvToTable(csv)).toEqual([
      ["name", "age", "active"],
      ["Alice", "30", "TRUE"],
      ["Bob", "25", "FALSE"],
    ]);
  });

  it("parses LF-only CSV without BOM", () => {
    const csv = "a,b\n1,2\n";
    expect(csvToTable(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields with embedded commas and double-quotes", () => {
    const csv = 'desc\r\n"hello, ""world"""\r\n';
    expect(csvToTable(csv)).toEqual([
      ["desc"],
      ['hello, "world"'],
    ]);
  });

  it("handles quoted fields with embedded newlines", () => {
    const csv = 'desc\r\n"line1\nline2"\r\n';
    expect(csvToTable(csv)).toEqual([
      ["desc"],
      ["line1\nline2"],
    ]);
  });

  it("handles empty CSV", () => {
    expect(csvToTable("")).toEqual([]);
    expect(csvToTable("\uFEFF")).toEqual([]);
  });
});

describe("round-trip: tableToCsv -> csvToTable", () => {
  it("round-trips a typed table through CSV (values become strings)", () => {
    const table: Table = [
      ["name", "score", "active", "createdAt"],
      ["Taro", 95, true, new Date(2025, 5, 1, 12, 0, 0)],
      ["Hanako", 88, false, null],
    ];
    const csv = tableToCsv(table);
    const parsed = csvToTable(csv);
    expect(parsed).toEqual([
      ["name", "score", "active", "createdAt"],
      ["Taro", "95", "TRUE", "2025-06-01 12:00:00"],
      ["Hanako", "88", "FALSE", ""],
    ]);
  });
});
