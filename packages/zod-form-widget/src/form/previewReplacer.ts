/**
 * 値のプレビュー（`showPreview`）の JSON.stringify の replacer。
 * bigint は文字に、Set は配列に、Map は [キー, 値] の配列にする（そのままでは `{}` になる）
 */
export const previewReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Set) return Array.from(value);
  if (value instanceof Map) return Array.from(value.entries());
  return value;
};
