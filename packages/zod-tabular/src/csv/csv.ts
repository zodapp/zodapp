import type { Table, TableCell } from "../types/publicTypes.js";

export function formatCell(cell: TableCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  if (cell instanceof Date) {
    const y = cell.getFullYear();
    const mo = String(cell.getMonth() + 1).padStart(2, "0");
    const d = String(cell.getDate()).padStart(2, "0");
    const h = String(cell.getHours()).padStart(2, "0");
    const mi = String(cell.getMinutes()).padStart(2, "0");
    const s = String(cell.getSeconds()).padStart(2, "0");
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
  return String(cell);
}

function escapeField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Table -> Excel互換CSV文字列。
 * BOM付きUTF-8、CRLF改行、TRUE/FALSE大文字、日付は "YYYY-MM-DD HH:mm:ss" 形式。
 */
export function tableToCsv(table: Table): string {
  const BOM = "\uFEFF";
  const lines = table.map((row) =>
    row.map((cell) => escapeField(formatCell(cell))).join(","),
  );
  return BOM + lines.join("\r\n") + "\r\n";
}

function parseField(field: string): string {
  if (field.length >= 2 && field[0] === '"' && field[field.length - 1] === '"') {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Excel互換CSV文字列 -> string[][] テーブル。
 * BOM自動除去、CRLF/LF両対応。セル値はすべてstringで返す。
 */
export function csvToTable(csv: string): string[][] {
  let text = csv;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = false;
          current += ch;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === "\r") {
        if (i + 1 < text.length && text[i + 1] === "\n") i++;
        rows.push(parseLine(current));
        current = "";
      } else if (ch === "\n") {
        rows.push(parseLine(current));
        current = "";
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0) {
    rows.push(parseLine(current));
  }

  return rows;
}
