/**
 * オブジェクトのキーをソートして JSON 文字列化する
 * 同じ内容のオブジェクトは常に同じ文字列になる
 * キー生成専用用のシンプルで高速な実装
 * キー生成に特化しているため循環参照対策やエッジケースは考慮していないことに注意
 */
export function stableStringify(value: unknown): string {
  // JSON.stringify(undefined) は undefined を返すため、明示的に "null" を返す
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }

  const sortedKeys = Object.keys(value as object).sort();
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const v = (value as Record<string, unknown>)[key];
    // JSON.stringify と同様に undefined のプロパティは省略
    if (v !== undefined) {
      parts.push(JSON.stringify(key) + ":" + stableStringify(v));
    }
  }

  return "{" + parts.join(",") + "}";
}
