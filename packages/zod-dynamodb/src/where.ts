import type { AllKeys, FieldType } from "./types";

type SizeOps = {
  eq?: number;
  ne?: number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};

/**
 * 1つのフィールドに対する書き込みの条件（§6.4）。複数の演算を指定するとANDになる。
 * いずれも `ConditionExpression` の範囲である。
 */
export type FieldCondition<V> = {
  eq?: V;
  ne?: V;
  gt?: V;
  gte?: V;
  lt?: V;
  lte?: V;
  between?: readonly [V, V];
  in?: readonly V[];
  exists?: true;
  notExists?: true;
  beginsWith?: string;
  contains?: unknown;
  size?: SizeOps;
};

/**
 * 書き込みの条件（`where`）。フィールドごとの条件をANDでまとめる。
 * 値をそのまま書くと等値の条件になる。オブジェクトの値と比べるときは `{ eq: … }` を使う。
 */
export type WhereOf<T> = {
  [K in AllKeys<T>]?: FieldType<T, K> | FieldCondition<FieldType<T, K>>;
};

export const CONDITION_OPS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "exists",
  "notExists",
  "beginsWith",
  "contains",
  "size",
] as const;

export type ConditionOp = (typeof CONDITION_OPS)[number];

/** 値が演算を並べたオブジェクトか（そうでなければ等値の条件） */
export const isFieldCondition = (
  value: unknown,
): value is FieldCondition<unknown> => {
  if (value === null || typeof value !== "object") return false;
  if (value instanceof Date || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.every((k) => (CONDITION_OPS as readonly string[]).includes(k))
  );
};

/** `where` を、フィールドごとの演算の一覧に正規化する */
export const normalizeWhere = (
  where: Record<string, unknown> | undefined,
): { field: string; op: ConditionOp; value: unknown }[] => {
  const out: { field: string; op: ConditionOp; value: unknown }[] = [];
  for (const [field, cond] of Object.entries(where ?? {})) {
    if (cond === undefined) continue;
    if (isFieldCondition(cond)) {
      for (const [op, value] of Object.entries(cond)) {
        if (value !== undefined)
          out.push({ field, op: op as ConditionOp, value });
      }
    } else {
      out.push({ field, op: "eq", value: cond });
    }
  }
  return out;
};

// ---- JS 上での評価（ブラウザの `can` で使う） ----

const comparable = (v: unknown): unknown =>
  v instanceof Date ? v.getTime() : v;

const deepEqual = (a: unknown, b: unknown): boolean => {
  a = comparable(a);
  b = comparable(b);
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
};

const compare = (a: unknown, b: unknown): number | undefined => {
  const x = comparable(a);
  const y = comparable(b);
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "string" && typeof y === "string")
    return x < y ? -1 : x > y ? 1 : 0;
  return undefined;
};

const sizeOf = (v: unknown): number | undefined => {
  if (typeof v === "string" || Array.isArray(v)) return v.length;
  if (v instanceof Set || v instanceof Map) return v.size;
  if (v !== null && typeof v === "object") return Object.keys(v).length;
  return undefined;
};

const evalOp = (value: unknown, op: ConditionOp, arg: unknown): boolean => {
  switch (op) {
    case "eq":
      return deepEqual(value, arg);
    case "ne":
      return !deepEqual(value, arg);
    case "gt": {
      const c = compare(value, arg);
      return c !== undefined && c > 0;
    }
    case "gte": {
      const c = compare(value, arg);
      return c !== undefined && c >= 0;
    }
    case "lt": {
      const c = compare(value, arg);
      return c !== undefined && c < 0;
    }
    case "lte": {
      const c = compare(value, arg);
      return c !== undefined && c <= 0;
    }
    case "between": {
      const [lo, hi] = arg as [unknown, unknown];
      const a = compare(value, lo);
      const b = compare(value, hi);
      return a !== undefined && b !== undefined && a >= 0 && b <= 0;
    }
    case "in":
      return (arg as unknown[]).some((x) => deepEqual(value, x));
    case "exists":
      return value !== undefined;
    case "notExists":
      return value === undefined;
    case "beginsWith":
      return typeof value === "string" && value.startsWith(arg as string);
    case "contains":
      if (typeof value === "string") return value.includes(arg as string);
      if (Array.isArray(value)) return value.some((x) => deepEqual(x, arg));
      if (value instanceof Set) return value.has(arg);
      return false;
    case "size": {
      const n = sizeOf(value);
      if (n === undefined) return false;
      return normalizeWhere({ n: arg as Record<string, unknown> }).every(
        (c) => c.op !== "size" && evalOp(n, c.op, c.value),
      );
    }
  }
};

/**
 * 書き込みの条件（`where`）を、手元の Item に対して JS 上で評価する。
 * DynamoDB の `ConditionExpression` と同じ意味になるようにしている（ブラウザの `can` で使う）。
 */
export const evaluateWhere = (
  item: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
): boolean =>
  normalizeWhere(where).every((c) => evalOp(item[c.field], c.op, c.value));
