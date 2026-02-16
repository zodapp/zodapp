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

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
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

export function parseJsonString(jsonString: string): unknown {
  return JSON.parse(jsonString, (key, value) => {
    if (
      typeof value === "string" &&
      value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    ) {
      return new Date(value);
    }
    return value;
  });
}
