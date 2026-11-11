/**
 * API の関数（`api.tasks.setStatus(key, params, options)`）の引数を、操作の入力に直す。
 * サーバーの API とブラウザの API で共通。`can` の判定もここに置く（同期、ブラウザでも動く）。
 */
import type { z } from "zod";
import { selectedFields, type Selection } from "./item-schema";
import type { AnyOp } from "./ops";
import type { CanResult } from "./register";
import { evaluateWhere } from "./where";

/** 操作ごとの入力（HTTP で送る入力を戻したものと同じ形） */
export type OpRequest = {
  key?: unknown;
  input?: unknown;
  args?: unknown;
  params?: unknown;
  ifUnchanged?: string;
  cursor?: string;
  limit?: number;
  fields?: Selection;
  withToken?: boolean;
};

/** 呼び出しの最後の引数（`context` など） */
export type CallOptions = Record<string, unknown> & { context?: unknown };

/** 操作の種類ごとの、位置引数の数（最後の options を除く） */
const ARITY: Record<AnyOp["kind"], number> = {
  get: 1,
  create: 2,
  createWithGeneratedKey: 2,
  set: 2,
  delete: 1,
  mutation: 2,
  query: 1,
  search: 1,
};

/** 位置引数を、操作の入力と options に分ける */
export const toRequest = (
  op: AnyOp,
  args: readonly unknown[],
): { request: OpRequest; options: CallOptions } => {
  const n = ARITY[op.kind];
  const options = (args[n] ?? {}) as CallOptions;
  const [a, b] = args;
  switch (op.kind) {
    case "get":
      return {
        request: { key: a, withToken: options.withToken === true },
        options,
      };
    case "create":
    case "set":
      return { request: { key: a, input: b }, options };
    case "createWithGeneratedKey":
      return { request: { args: a, input: b }, options };
    case "delete":
      return { request: { key: a }, options };
    case "mutation":
      return {
        request: {
          key: a,
          params: b,
          ifUnchanged: options.ifUnchanged as string | undefined,
        },
        options,
      };
    case "query":
      return {
        request: {
          params: a,
          cursor: options.cursor as string | undefined,
          limit: options.limit as number | undefined,
          fields: options.fields as Selection | undefined,
        },
        options,
      };
    case "search":
      return {
        request: {
          params: a,
          fields: options.fields as Selection | undefined,
        },
        options,
      };
  }
};

/** 指定したフィールドだけを残す（`fields` の指定。キーのフィールドは常に残す） */
export const selectItemFields = <T>(
  op: AnyOp,
  items: T[],
  fields: Selection | undefined,
): T[] => {
  const set = selectedFields(op.table, fields);
  if (!set) return items;
  return items.map((item) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (set.has(k)) out[k] = v;
    }
    return out as T;
  });
};

type Raw = Record<string, unknown>;

const parseOrIssues = (
  schema: z.ZodType,
  value: unknown,
): { ok: true; data: any } | { ok: false; issues: z.core.$ZodIssue[] } => {
  const r = schema.safeParse(value);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, issues: r.error.issues };
};

/** `can` の判定に使う、検証した入力（認可が受け取る形） */
const validated = (
  op: AnyOp,
  request: OpRequest,
): { ok: true; req: Raw } | { ok: false; issues: z.core.$ZodIssue[] } => {
  const table = op.table;
  const parts: [string, z.ZodType, unknown][] = [];
  switch (op.kind) {
    case "get":
    case "delete":
      parts.push(["key", table._compiled.keySchema, request.key]);
      break;
    case "create":
      parts.push(["key", table._compiled.keySchema, request.key]);
      parts.push(["input", table.create, request.input]);
      break;
    case "createWithGeneratedKey":
      parts.push(["args", table.generateKeyArgs!, request.args]);
      parts.push(["input", table.create, request.input]);
      break;
    case "set":
      parts.push(["key", table._compiled.keySchema, request.key]);
      parts.push(["input", table.item, request.input]);
      break;
    case "mutation":
      parts.push(["key", table._compiled.keySchema, request.key]);
      parts.push(["params", op.params, request.params]);
      break;
    case "query":
    case "search":
      parts.push(["params", op.params, request.params]);
      break;
  }
  const req: Raw = {};
  const issues: z.core.$ZodIssue[] = [];
  for (const [name, schema, value] of parts) {
    const r = parseOrIssues(schema, value);
    if (r.ok) req[name] = r.data;
    else
      issues.push(...r.issues.map((i) => ({ ...i, path: [name, ...i.path] })));
  }
  return issues.length ? { ok: false, issues } : { ok: true, req };
};

/**
 * 操作を実行できるかを、同期で判定する。入力の検証 → `authorize` → `where`（`item` を渡したとき）。
 * 判定に使うのは共有の定義だけで、サーバーの上書きは含まない。
 */
export const checkCan = (
  op: AnyOp,
  request: OpRequest,
  context: unknown,
  item?: unknown,
): CanResult => {
  const v = validated(op, request);
  if (!v.ok) return { ok: false, reason: "INVALID_INPUT", issues: v.issues };
  if (op.authorize) {
    if (context === undefined || context === null)
      return { ok: false, reason: "NO_CONTEXT" };
    const authorize = op.authorize as (ctx: unknown, req: Raw) => boolean;
    if (authorize(context, v.req) !== true) {
      return { ok: false, reason: "FORBIDDEN" };
    }
  }
  if (item !== undefined && item !== null) {
    const doc = item as Raw;
    let ok = true;
    switch (op.kind) {
      case "delete":
        if (op.where)
          ok = evaluateWhere(doc, op.where({} as never, context) as never);
        break;
      case "mutation":
        if (op.where) {
          ok = evaluateWhere(doc, op.where(v.req.params, context) as never);
        }
        break;
      case "query":
        ok = op.matches(doc, v.req.params, context);
        break;
    }
    if (!ok) return { ok: false, reason: "CONDITION" };
  }
  return { ok: true };
};

/**
 * 呼び出しのオプションから認証コンテキストを決める。
 * `context` キーを書いたら、値が `null` / `undefined` でもその値（認証コンテキストなし）を使い、
 * スコープ（サーバーの `scope()`・router、ブラウザの `bind`・グローバル）には戻らない。
 * キーがなければ `fallback` の値を使う
 */
export const contextFromOptions = (
  options: { readonly context?: unknown } | undefined,
  fallback: () => unknown,
): unknown =>
  options !== undefined && options !== null && Object.hasOwn(options, "context")
    ? options.context
    : fallback();

/** `can` の位置引数（最後は `{ context, item }`）を、判定に直す */
export const canFromArgs = (
  op: AnyOp,
  args: readonly unknown[],
  resolveContext: (options: CallOptions) => unknown,
): CanResult => {
  const { request, options } = toRequest(op, args);
  return checkCan(
    op,
    request,
    resolveContext(options),
    (options as { item?: unknown }).item,
  );
};
