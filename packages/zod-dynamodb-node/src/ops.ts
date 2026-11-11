/**
 * 共有の定義（`createOps`）の操作を、上書き（`override`）を合わせて実行する。
 * 入力の検証 → 認可 → 実行（`where` と `patch` は上書きを合わせたもの）の順に行う。
 */
import {
  DefinitionError,
  ValidationError,
  isOp,
  selectItemFields,
  type AnyOp,
  type MutationDef,
  type SearchDef,
  type Override,
  type OpRequest,
  type OverrideImpl,
} from "@zodapp/zod-dynamodb";
import type { z } from "zod";
import { ForbiddenError, MissingContextError } from "./errors";
import { Validated } from "./validated";

type Raw = Record<string, unknown>;

export type ExecuteOptions = {
  /** 認証コンテキスト。`authorize` を持つ操作では必須 */
  context?: unknown;
};

/** 上書きを、操作から引けるようにする。同じ操作への上書きの重複はエラー */
export const overrideMap = (
  overrides: readonly Override[] | undefined,
): ReadonlyMap<AnyOp, OverrideImpl<any, any>> => {
  const map = new Map<AnyOp, OverrideImpl<any, any>>();
  const mark = overrides?.[0]?.mark;
  for (const o of overrides ?? []) {
    if (o?.kind !== "override" || !isOp(o.op)) {
      throw new DefinitionError("overrides takes values made by override()");
    }
    if (o.mark !== mark) {
      throw new DefinitionError(
        `override of operation "${o.op.name}": operations from different defineContext calls are mixed`,
      );
    }
    if (map.has(o.op)) {
      throw new DefinitionError(
        `operation "${o.op.name}" is overridden more than once`,
      );
    }
    map.set(o.op, o.impl);
  }
  return map;
};

/**
 * ミューテーションの操作に上書きを合わせた定義を作る。
 * 上書きの関数は非同期でもよいので、`patch` と `where` は Promise を返すことがある。
 */
export const effectiveMutation = (
  op: MutationDef,
  impl: OverrideImpl<any, any> | undefined,
): MutationDef => {
  const o = impl as
    | {
        patch?: (p: unknown, ctx: unknown, shared: unknown) => unknown;
        where?: (p: unknown, ctx: unknown, shared: unknown) => unknown;
      }
    | undefined;
  if (!o?.patch && !o?.where) return op;
  const sharedPatch = (p: unknown, ctx: unknown) => op.patch?.(p, ctx) ?? {};
  const sharedWhere = (p: unknown, ctx: unknown) => op.where?.(p, ctx);
  return {
    ...op,
    patch: o.patch
      ? (p: unknown, ctx: unknown) => o.patch!(p, ctx, sharedPatch)
      : op.patch,
    where: o.where
      ? (p: unknown, ctx: unknown) => o.where!(p, ctx, sharedWhere)
      : op.where,
  } as MutationDef;
};

/** 検索の操作に、上書きの `queryVector` を合わせた定義を作る */
export const effectiveSearch = (
  op: SearchDef,
  impl: OverrideImpl<any, any> | undefined,
): SearchDef => {
  const queryVector = (
    impl as
      | {
          queryVector?: (
            p: unknown,
            ctx: unknown,
            runtime: { vectorConfig: unknown },
          ) => unknown;
        }
      | undefined
  )?.queryVector;
  if (!queryVector) {
    throw new DefinitionError(
      `search "${op.name}" needs queryVector: add override(op, { queryVector }) to createRepository`,
    );
  }
  return {
    ...op,
    queryVector: (p: unknown, ctx: { vectorConfig?: unknown }) =>
      queryVector(p, ctx, { vectorConfig: ctx?.vectorConfig }),
  } as SearchDef;
};

const parse = <T>(schema: z.ZodType<T>, value: unknown, what: string): T => {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ValidationError(
      `invalid ${what}: ${r.error.message}`,
      r.error.issues,
    );
  }
  return r.data;
};

/** 認可が受け取るリクエストを、検証した入力から作る */
const authorizeRequest = (op: AnyOp, req: OpRequest): Raw => {
  const table = op.table;
  switch (op.kind) {
    case "get":
    case "delete":
      return { key: parse(table._compiled.keySchema, req.key, "key") };
    case "create":
      return {
        key: parse(table._compiled.keySchema, req.key, "key"),
        input: parse(table.create, req.input, "input"),
      };
    case "createWithGeneratedKey":
      return {
        args: parse(table.generateKeyArgs!, req.args, "args"),
        input: parse(table.create, req.input, "input"),
      };
    case "set":
      return {
        key: parse(table._compiled.keySchema, req.key, "key"),
        input: parse(table.item, req.input, "input"),
      };
    case "mutation":
      return {
        key: parse(table._compiled.keySchema, req.key, "key"),
        params: parse(op.params, req.params, "params"),
      };
    case "query":
    case "search":
      return { params: parse(op.params, req.params, "params") };
    default:
      throw new DefinitionError(
        `unsupported operation kind "${(op as { kind: string }).kind}"`,
      );
  }
};

/**
 * 入力の検証と認可だけを行う（リアルタイムの購読で使う）。拒否は `ForbiddenError`。
 * 検証した入力（認可が受け取る形）を返す。認可は同期で行う（データベースは読まない）
 */
export const authorizeOp = (
  overrides: ReadonlyMap<AnyOp, OverrideImpl<any, any>>,
  op: AnyOp,
  req: OpRequest,
  options: ExecuteOptions = {},
): Raw => {
  const request = authorizeRequest(op, req);
  if (op.authorize) {
    const { context } = options;
    // null も「認証コンテキストなし」。匿名はアプリが値で表す
    if (context === undefined || context === null) {
      throw new MissingContextError(op.name);
    }
    const impl = overrides.get(op) as
      | { authorize?: (ctx: unknown, req: Raw, shared: unknown) => unknown }
      | undefined;
    const shared = op.authorize as (ctx: unknown, req: Raw) => boolean;
    const allowed = impl?.authorize
      ? impl.authorize(context, request, shared)
      : shared(context, request);
    if (isPromiseLike(allowed)) {
      throw new DefinitionError(
        `operation "${op.name}": authorize must be synchronous (read what it needs when the auth context is built)`,
      );
    }
    if (allowed !== true) throw new ForbiddenError();
  }
  return request;
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  (typeof value === "object" || typeof value === "function") &&
  typeof (value as { then?: unknown }).then === "function";

/** Repository のうち、実行に使う部分 */
type AccessorLike = Record<string, (...args: any[]) => Promise<any>>;

/**
 * 操作を 1 回実行する。戻り値はサーバーの API の形
 * （get は `{ item, token }`、書き込みは Item、delete は削除前の Item、クエリは `{ items, cursor }`）。
 */
export const executeOp = async (
  accessor: AccessorLike,
  overrides: ReadonlyMap<AnyOp, OverrideImpl<any, any>>,
  op: AnyOp,
  req: OpRequest,
  options: ExecuteOptions = {},
): Promise<unknown> => {
  const { context } = options;
  const impl = overrides.get(op) as
    | {
        authorize?: (ctx: unknown, req: Raw, shared: unknown) => unknown;
        where?: (p: unknown, ctx: unknown, shared: unknown) => unknown;
      }
    | undefined;

  // 1. 入力の検証と、2. 認可
  const request = authorizeOp(overrides, op, req, options);

  // 3. 実行
  switch (op.kind) {
    case "get": {
      if (req.withToken) {
        const found = await accessor.get!(request.key, { withToken: true });
        return found
          ? { item: found.item, token: found.token }
          : { item: null };
      }
      return (await accessor.get!(request.key)) ?? null;
    }
    // 書き込みには、認可の前に検証した値（authorize が見た値）を渡し、もう一度 parse しない
    case "create":
      return accessor.create!(request.key, new Validated(request.input));
    case "createWithGeneratedKey":
      return accessor.createWithGeneratedKey!(
        new Validated(request.args),
        new Validated(request.input),
      );
    case "set":
      return accessor.set!(request.key, new Validated(request.input));
    case "delete": {
      const sharedWhere = (p: unknown, ctx: unknown) =>
        op.where?.(p as never, ctx);
      const where = impl?.where
        ? await impl.where({}, context, sharedWhere)
        : sharedWhere({}, context);
      return accessor.delete!(request.key, where ? { where } : {});
    }
    case "mutation":
      return accessor.mutate!(op, request.key, new Validated(request.params), {
        context,
        ifUnchanged: req.ifUnchanged,
      });
    case "search": {
      const results = (await accessor.search!(
        op,
        new Validated(request.params),
        {
          context,
        },
      )) as { item: Raw; score: number }[];
      const items = selectItemFields(
        op,
        results.map((r) => r.item),
        req.fields,
      );
      return results.map((r, i) => ({ item: items[i], score: r.score }));
    }
    case "query": {
      const res = await accessor.query!(op, new Validated(request.params), {
        cursor: req.cursor,
        limit: req.limit,
        context,
      });
      return {
        items: selectItemFields(op, res.items, req.fields),
        ...(res.cursor ? { cursor: res.cursor } : {}),
      };
    }
  }
};
