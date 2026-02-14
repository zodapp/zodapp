import { ParamsTree, ParamsTreeItem } from "./utils/types";
import {
  fromParamsTree,
  toParamsTree,
  toParamsTreeWithoutSchema,
} from "./utils/transformer";
import z from "zod";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a !== typeof b) return false;
  if (isObject(a) && isObject(b)) {
    return (
      Object.keys(a).every((key) => deepEqual(a[key], b[key])) &&
      Object.keys(b).every((key) => deepEqual(a[key], b[key]))
    );
  }
  return a === b;
};

/**
 * `URLSearchParams` をスキーマに従ってデコードし、型付きオブジェクトへ変換します。
 *
 * `schema` の定義に合わせて、`string` から number/date/set/map 等へ復元します。
 */
export const decodeSearchParams = <T extends z.ZodObject<z.ZodRawShape>>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> => {
  const paramsTree = searchParamsToParamsTree(searchParams);
  return fromParamsTree<T>(paramsTree, schema);
};

/**
 * オブジェクトを `URLSearchParams` にエンコードします。
 *
 * `schema` を渡すと、スキーマに従って date/set/map 等を文字列表現へ変換します。
 * `validate=true` の場合、再デコードして元の値と等しいか簡易検証します。
 */
export const encodeSearchParams = <T extends z.ZodObject<z.ZodRawShape>>(
  obj: z.infer<T>,
  schema?: T,
  validate: boolean = false,
): URLSearchParams => {
  const paramsTree = schema
    ? toParamsTree(obj, schema)
    : toParamsTreeWithoutSchema(obj);
  const searchParams = paramsTreeToSearchParams(paramsTree);
  if (validate) {
    if (!schema) {
      throw new Error("validate requires schema");
    }
    const reparsed = decodeSearchParams(searchParams, schema);
    if (!deepEqual(reparsed, obj)) {
      throw new Error("reparsed value is not equal to original value");
    }
  }
  return searchParams;
};

/**
 * `URLSearchParams` を `ParamsTree`（ネストしたオブジェクト）へ変換します。
 *
 * 例: `a.b=1` は `{ a: { b: \"1\" } }` のように保持します。
 */
export const searchParamsToParamsTree = (
  searchParams: URLSearchParams,
): ParamsTree => {
  const obj: ParamsTree = {};

  // Iterate over each key-value pair in URLSearchParams
  for (const [key, value] of searchParams.entries()) {
    // Split the key on dot (.) to handle nested properties
    const keys = key.split(".").map((part) => unescapeFieldPathPart(part));
    let current: ParamsTree = obj;

    // Traverse the object structure based on the split keys
    keys.forEach((subKey, index) => {
      // If we are at the last segment, assign the value
      if (index === keys.length - 1) {
        current[subKey] = value;
      } else {
        // If the property does not exist or is not an object, create it as an empty object
        if (typeof current[subKey] !== "object" || current[subKey] === null) {
          current[subKey] = {};
        }
        // Move deeper into the object
        current = current[subKey] as ParamsTree;
      }
    });
  }
  return obj;
};

const paramsTreeToSearchParams = (obj: ParamsTree): URLSearchParams => {
  const searchParams = new URLSearchParams();
  const traverse = (current: ParamsTreeItem, path: string[] = []) => {
    if (current === null || current === undefined) {
      return;
    }
    for (const [key, value] of Object.entries(current)) {
      const currentPath = [...path, escapeFieldPathPart(key)];
      if (typeof value === "object" && value !== null) {
        traverse(value, currentPath);
      } else if (value !== undefined) {
        searchParams.set(currentPath.join("."), value);
      }
    }
  };
  traverse(obj);
  return searchParams;
};

const escapeFieldPathPart = (part: string) => {
  // encodeURIComponent does not encode '.', so we force it to be encoded as '%2e'
  // to avoid collisions with '.' as the path separator.
  return encodeURIComponent(part).replaceAll(".", "%2e");
};

const unescapeFieldPathPart = (part: string) => {
  // decodeURIComponent already decodes '%2e' -> '.'. No special casing needed.
  try {
    return decodeURIComponent(part);
  } catch {
    // Be tolerant to malformed inputs (e.g. stray '%') and keep the raw part.
    return part;
  }
};
