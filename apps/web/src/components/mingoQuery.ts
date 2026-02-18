import { Query } from "mingo";
import { Context } from "mingo/core";
import { resolve } from "mingo/util";

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * 再帰的に undefined を削除する
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
    const cleaned = cleanQuery(value);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }
  return result as T;
};

/**
 * カスタムクエリオペレータ: $contains
 * 大文字小文字を無視した部分一致検索
 * 使用例: { title: { $contains: "検索語" } }
 */
const $contains = (selector: string, value: unknown) => {
  const pattern = typeof value === "string" ? value : String(value);
  const regex = new RegExp(escapeRegex(pattern), "i");
  return (obj: Record<string, unknown>) => {
    const fieldValue = resolve(obj, selector);
    return typeof fieldValue === "string" && regex.test(fieldValue);
  };
};

const context = Context.init().addQueryOps({ $contains });

/**
 * クエリオブジェクトからmingoフィルター関数を作成する
 * @param query - MongoDBライクなクエリオブジェクト（$contains カスタムオペレータ対応）
 * @returns フィルター関数、またはクエリがない場合はundefined
 */
export const createMingoFilter = (
  query: Record<string, unknown> | undefined,
): ((item: Record<string, unknown>) => boolean) | undefined => {
  if (!query) return undefined;
  const cleaned = cleanQuery(query);
  if (!cleaned) return undefined;
  const mingoQuery = new Query(cleaned, { context });
  return (item: Record<string, unknown>) => mingoQuery.test(item);
};
