import { Query } from "mingo";
import { Context } from "mingo/core";
import { resolve } from "mingo/util";

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * mingo に渡す前に、クエリから「条件になっていないもの」を再帰的に取り除く。
 *
 * - undefined の値を削除する
 * - 削除した結果が空になった plain object（`{ name: {} }` の `{}`）も削除する。
 *   mingo は `{ name: {} }` を「name が空 object と等しい」と解釈し、何もヒットしなくなるため
 * - Date / Set / Map はそのまま残す。配列は要素を掃除するが、空になっても残す
 *
 * 全体が空になったときは undefined を返す（条件なし）。
 */
export const cleanQuery = <T>(obj: T): T | undefined => {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanQuery).filter((v) => v !== undefined) as T;
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleaned = cleanQuery(value);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }
  return Object.keys(result).length > 0 ? (result as T) : undefined;
};

/**
 * カスタムクエリオペレータ: $contains
 * 大文字小文字を無視した部分一致検索
 * 使用例: { title: { $contains: "検索語" } }
 */
// mingo 7.2 の型は、演算子が options も受け取る形を要求する
const $contains = (selector: string, value: unknown, _options?: unknown) => {
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
