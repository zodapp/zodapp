import { Query } from "mingo";

/**
 * 正規表現の特殊文字をエスケープする
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * 再帰的に undefinedを削除し、$containsを$regexに変換する
 *
 * $contains: 部分一致検索（大文字小文字を無視）
 * 使用例: { title: { $contains: "検索語" } }
 *
 * 将来的に高機能版が必要な場合は $textSearch として拡張予定
 */
export const cleanQuery = <T>(obj: T): T => {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanQuery).filter((v) => v !== undefined) as T;
  }

  if (obj instanceof Date || obj instanceof Set || obj instanceof Map) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // $contains を $regex に変換（大文字小文字を無視した部分一致）
    if (key === "$contains" && typeof value === "string") {
      result["$regex"] = escapeRegex(value);
      result["$options"] = "i";
      continue;
    }

    const cleaned = cleanQuery(value);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }
  return result as T;
};

/**
 * クエリオブジェクトをクリーンアップしてからmingoフィルター関数を作成する
 * @param query - クリーンアップ前のクエリオブジェクト（MongoDBライクなクエリ）
 * @returns フィルター関数、またはクエリがない場合はundefined
 */
export const createMingoFilter = (
  query: Record<string, unknown> | undefined,
): ((item: Record<string, unknown>) => boolean) | undefined => {
  if (!query) return undefined;
  const cleaned = cleanQuery(query);
  if (!cleaned) return undefined;
  const mingoQuery = new Query(cleaned);
  return (item: Record<string, unknown>) => mingoQuery.test(item);
};
