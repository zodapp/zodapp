import { z } from "zod";
import { preprocess, postprocess } from "@zodapp/zod-transform";
import dayjs from "dayjs";
import { ParamsTree, ParamsTreeItem } from "./types";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const dateFormatString = "YYYYMMDDHHmmssSSS";

const parseArrayLike = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  const arr: unknown[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.match(/^\d+$/)) {
      arr[Number(key)] = child;
    }
  }
  return arr;
};

/**
 * `ParamsTree` をスキーマに従ってデコードし、型付きオブジェクトへ変換します。
 *
 * `preprocess()` を利用して、`string` から number/date/bigint/set/map 等へ復元します。
 */
export const fromParamsTree = <T extends z.ZodObject<z.ZodRawShape>>(
  obj: ParamsTree,
  schema: T,
): z.infer<T> => {
  return preprocess(obj, schema, {
    set: (value: unknown[]) => {
      return new Set(parseArrayLike(value));
    },
    map: (value: Record<string, unknown>) => {
      return new Map(value ? Object.entries(value) : []);
    },
    date: (value: string) => {
      return dayjs.utc(value, dateFormatString).toDate();
    },
    bigint: (value: string) => {
      return BigInt(value);
    },
    number: (value: string) => {
      return Number(value);
    },
    undefined: (value: unknown) => {
      if (value === "undefined" || value === undefined) return undefined;
      // union判定のために値をそのまま返し、次のスキーマに委ねる
      return value as unknown as undefined;
    },
    null: (value: unknown) => {
      if (value === "null" || value === null) return null;
      // union判定のために値をそのまま返し、次のスキーマに委ねる
      return value as unknown as null;
    },
    boolean: (value: string) => {
      if (value === "true") return true;
      if (value === "false") return false;
      throw new Error("Invalid value for ZodBoolean");
    },
    array: (value: unknown) => {
      return parseArrayLike(value);
    },
    tuple: (value: unknown[]) => {
      return parseArrayLike(value);
    },
  });
};

export const toParamsTree = <T extends z.ZodObject<z.ZodRawShape>>(
  obj: z.infer<T>,
  schema: T,
): ParamsTree => {
  return postprocess(obj, schema, {
    set: (value: Set<unknown>) => {
      return Array.from(value);
    },
    map: (value: Map<unknown, unknown>) => {
      return Object.fromEntries(value);
    },
    date: (value: Date) => {
      return dayjs(value).utc().format(dateFormatString);
    },
    bigint: (value: bigint) => {
      return value.toString();
    },
    number: (value: number) => {
      return value.toString();
    },
    undefined: () => {
      return "undefined";
    },
    null: () => {
      return "null";
    },
    boolean: (value: boolean) => {
      return value.toString();
    },
  }) as ParamsTree;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Schema を使わずに、unknown 値を ParamsTree に変換する。
 */
export const toParamsTreeWithoutSchema = (obj: unknown): ParamsTree => {
  const seen = new WeakSet<object>();

  const toItem = (value: unknown): ParamsTreeItem => {
    if (value === null) return "null";
    // undefined は URL パラメータから除外する（optional フィールドの自然な動作）
    if (value === undefined) return undefined;

    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "boolean") return value.toString();

    if (value instanceof Date) {
      return dayjs(value).utc().format(dateFormatString);
    }

    if (value instanceof Set) {
      return Array.from(value).map((v) => toItem(v));
    }

    if (value instanceof Map) {
      return Object.fromEntries(
        Array.from(value.entries()).map(([k, v]) => [k, toItem(v)]),
      );
    }

    if (Array.isArray(value)) {
      return value.map((v) => toItem(v));
    }

    if (isPlainObject(value)) {
      if (seen.has(value)) {
        throw new Error(
          "toParamsTreeWithoutSchema: circular reference detected",
        );
      }
      seen.add(value);
      // undefined 値を持つプロパティは除外する
      return Object.fromEntries(
        Object.entries(value)
          .map(([k, v]) => [k, toItem(v)] as const)
          .filter(([, v]) => v !== undefined),
      );
    }

    // Fallback: best-effort stringify for other primitives / class instances
    return String(value);
  };

  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    throw new Error("toParamsTreeWithoutSchema: root must be an object");
  }
  return toItem(obj) as ParamsTree;
};
