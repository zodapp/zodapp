import { csvToTable } from '@zodapp/zod-tabular';

export type DynamicTabularCellValue = string | number | null;

export type DynamicTabularRow = Record<string, DynamicTabularCellValue>;

export type DynamicTabularParseResult = {
  headers: string[];
  rows: DynamicTabularRow[];
};

const hasNonEmptyCell = (line: unknown[]) => line.some((cell) => String(cell ?? '').trim() !== '');

export const normalizeDynamicTabularCellValue = (value: unknown): DynamicTabularCellValue => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  return normalized;
};

export const toDynamicTabularRow = (
  rawRow: Record<string, unknown>,
  headers: string[]
): DynamicTabularRow => {
  const result: DynamicTabularRow = {};
  for (const header of headers) {
    result[header] = normalizeDynamicTabularCellValue(rawRow[header]);
  }
  return result;
};

export const parseDynamicTabularFile = async (file: File): Promise<DynamicTabularParseResult> => {
  const csv = await file.text();
  const table = csvToTable(csv);
  if (table.length === 0) {
    throw new Error('CSVファイルが空です。');
  }

  const headers = (table[0] ?? []).map((cell) => String(cell ?? '').trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new Error('CSVヘッダーが見つかりません。');
  }

  const rows = table
    .slice(1)
    .filter((line) => hasNonEmptyCell(line))
    .map((line) => {
      const rawRow: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        rawRow[header] = line[index] ?? '';
      });
      return toDynamicTabularRow(rawRow, headers);
    });

  if (rows.length === 0) {
    throw new Error('CSVにデータ行がありません。');
  }

  return { headers, rows };
};

export const buildDynamicTabularPreviewRows = (
  rows: DynamicTabularRow[],
  limit = 20
): DynamicTabularRow[] => rows.slice(0, limit);
