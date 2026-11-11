import { z } from "zod";
import {
  endpoint as makeEndpoint,
  type Endpoint,
  type FieldsInput,
  type HttpMethod,
} from "./endpoint";
import { DefinitionError } from "./errors";
import type { AnyOp, ContextMark, IsPublicOp } from "./ops";
import { contextMarkOf, contextParts, isOp, newContextMark } from "./ops";
import {
  subscription as makeSubscription,
  type AnySubscriptionDef,
} from "./subscription";

/** 登録簿の 1 件：どの操作を、どう公開するか */
export type EndpointEntry = {
  readonly op: AnyOp;
  /** HTTP のパス。省略すると HTTP では公開しない */
  readonly path?: string;
  /** HTTP メソッド。既定は `POST` */
  readonly method?: HttpMethod;
  /** リアルタイムでも公開する（クエリだけ）。`{ fields }` で届けるフィールドを絞る */
  readonly live?: true | { readonly fields?: FieldsInput<any> };
};

/** 登録簿の入力：グループ名から、エントリーの並び */
export type EndpointGroups = Readonly<Record<string, readonly EndpointEntry[]>>;

/** 登録簿の 1 件を、実行時に使える形にしたもの */
export type ResolvedEntry = {
  readonly group: string;
  /** 操作の名前（`createOps` のキー） */
  readonly name: string;
  readonly op: AnyOp;
  /** `authorize` を持たない（サーバー専用） */
  readonly serverOnly: boolean;
  readonly path: string | undefined;
  readonly method: HttpMethod;
  /** HTTP の入出力の変換（サーバー専用でない操作だけ） */
  readonly endpoint: Endpoint | undefined;
  /** 購読の入出力の変換（`live` があるときだけ） */
  readonly subscription: AnySubscriptionDef | undefined;
};

/** 登録簿。`defineEndpoints` で作る */
export type Endpoints<G extends EndpointGroups = EndpointGroups> = {
  readonly kind: "endpoints";
  readonly groups: G;
  /** 操作を作った `defineContext` の目印（操作がなければ `undefined`）。上書きとの照合に使う */
  readonly mark: ContextMark | undefined;
  readonly entries: readonly ResolvedEntry[];
  /** 操作から、そのエントリーを引く */
  entryOf(op: AnyOp): ResolvedEntry | undefined;
  /** グループ名と操作の名前から、エントリーを引く（購読の識別に使う） */
  entryByName(group: string, name: string): ResolvedEntry | undefined;
};

const GROUP_NAME = /^[A-Za-z_$][\w$]*$/;

/** HTTP で GET を付けられる操作の種類（読み取りだけ） */
const GET_KINDS: ReadonlySet<AnyOp["kind"]> = new Set([
  "get",
  "query",
  "search",
]);

/** `method + path` の重複を比べる形。Express のパラメーター（`:name`）は名前によらず同じとみなす */
const routeKey = (method: HttpMethod, path: string) =>
  `${method} ${path.replace(/:[^/]+/g, ":")}`;

// ---- 型での検査 ----

/** 型のエラーの文言（エディタに出る） */
export type DefinitionTypeError<M extends string> = {
  readonly __definitionError: M;
};

/** HTTP で GET を付けられる種類 */
type GetFriendlyKind = "get" | "query" | "search";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Auth の一致。TAuth が unknown（単独の defineEndpoints）なら見ない */
type AuthCheck<O extends AnyOp, TAuth> = unknown extends TAuth
  ? O
  : Equals<O["$auth"], TAuth> extends true
    ? O
    : DefinitionTypeError<"this operation was made by another defineContext (its auth type differs)">;

/** 1 件の検査。問題があれば、そのプロパティの型を DefinitionTypeError にする */
type EntryCheck<E, TAuth> = E extends { readonly op: infer O }
  ? O extends AnyOp
    ? {
        readonly op: AuthCheck<O, TAuth>;
        readonly path?: IsPublicOp<O> extends true
          ? string
          : DefinitionTypeError<"an operation without authorize is server-only: it cannot have path">;
        readonly method?: O["kind"] extends GetFriendlyKind
          ? HttpMethod
          : Exclude<HttpMethod, "GET">;
        readonly live?: IsPublicOp<O> extends false
          ? DefinitionTypeError<"an operation without authorize is server-only: it cannot be live">
          : O["kind"] extends "query"
            ? true | { readonly fields?: FieldsInput<O["table"]> }
            : DefinitionTypeError<"live is only for queries">;
      }
    : DefinitionTypeError<"every entry needs an operation made by createOps">
  : never;

/** 登録簿全体の型の検査。問題のあるエントリーのプロパティだけをエラーにする */
export type CheckGroups<G extends EndpointGroups, TAuth = unknown> = {
  readonly [K in keyof G]: CheckList<G[K], TAuth>;
};

/** グループの中のエントリーの並び（タプルのまま写す） */
type CheckList<L, TAuth> = {
  readonly [I in keyof L]: EntryCheck<L[I], TAuth>;
};

/** 操作から、HTTP の入出力の変換を作る（パスとメソッドは登録簿のもの） */
const endpointFor = (op: AnyOp, path: string, method: HttpMethod): Endpoint => {
  const options = { path, method };
  switch (op.kind) {
    case "get":
      return makeEndpoint.get(op.table, { ...options, withToken: true });
    case "create":
      return makeEndpoint.create(op.table, options);
    case "createWithGeneratedKey":
      return makeEndpoint.createWithGeneratedKey(op.table, {
        ...options,
        args: op.table.generateKeyArgs!,
      });
    case "set":
      return makeEndpoint.set(op.table, options);
    case "delete":
      return makeEndpoint.delete(op.table, options);
    case "mutation":
      return makeEndpoint.mutation(op, options);
    case "query":
      return makeEndpoint.query(op, options);
    case "search":
      return makeEndpoint.search(op, options);
  }
};

/**
 * 登録簿を作る。作るときに次を検査する（違反は `DefinitionError`）。
 * - グループの中で、操作の名前が重ならないこと（同じ操作を 2 回書くことも含む）
 * - `authorize` を持たない操作（サーバー専用）に、`path` と `live` を付けないこと
 * - `live` はクエリだけに付けること
 * - `GET` は `get`・`query`・`search` だけに付けること
 * - `method + path` が重ならないこと（パラメーターの名前は無視する）
 * - すべての操作が、同じ `defineContext` から作られていること
 *
 * 型でも、サーバー専用の操作の `path`・`live`、クエリ以外の `live`、書き込みの `GET` を弾く。
 * Auth の型の一致まで型で確かめるには、`defineContext` が返す `defineEndpoints` を使う。
 */
export const defineEndpoints = <const G extends EndpointGroups>(
  groups: G & CheckGroups<G>,
): Endpoints<G> => buildEndpoints(groups, undefined);

const buildEndpoints = <G extends EndpointGroups>(
  groups: G,
  expected: ContextMark | undefined,
): Endpoints<G> => {
  const entries: ResolvedEntry[] = [];
  const byOp = new Map<AnyOp, ResolvedEntry>();
  const byName = new Map<string, ResolvedEntry>();
  const byRoute = new Map<string, ResolvedEntry>();
  let mark = expected;
  for (const [group, list] of Object.entries(groups)) {
    if (!GROUP_NAME.test(group)) {
      throw new DefinitionError(`invalid group name "${group}"`);
    }
    const names = new Set<string>();
    for (const entry of list) {
      const { op } = entry;
      if (!isOp(op)) {
        throw new DefinitionError(
          `group "${group}": every entry needs an operation made by createOps`,
        );
      }
      const where = `group "${group}", operation "${op.name}"`;
      const opMark = contextMarkOf(op);
      if (mark === undefined) mark = opMark;
      if (opMark !== mark) {
        throw new DefinitionError(
          `${where}: operations from different defineContext calls are mixed`,
        );
      }
      if (names.has(op.name)) {
        throw new DefinitionError(`${where}: the name is used twice`);
      }
      names.add(op.name);
      if (byOp.has(op)) {
        throw new DefinitionError(
          `${where}: the operation is already registered in group "${byOp.get(op)!.group}"`,
        );
      }
      const serverOnly = op.authorize === undefined;
      if (serverOnly && (entry.path !== undefined || entry.live)) {
        throw new DefinitionError(
          `${where}: an operation without authorize is server-only and cannot have path or live`,
        );
      }
      if (entry.live && op.kind !== "query") {
        throw new DefinitionError(`${where}: live is only for queries`);
      }
      if (entry.path !== undefined && !entry.path.startsWith("/")) {
        throw new DefinitionError(`${where}: path must start with "/"`);
      }
      const method = entry.method ?? "POST";
      if (method === "GET" && !GET_KINDS.has(op.kind)) {
        throw new DefinitionError(
          `${where}: GET is only for get, query and search`,
        );
      }
      const resolved: ResolvedEntry = {
        group,
        name: op.name,
        op,
        serverOnly,
        path: entry.path,
        method,
        // HTTP の入出力の変換。パスがなくても、`handle()` で個別に公開できるように作る
        endpoint: serverOnly
          ? undefined
          : endpointFor(op, entry.path ?? "", method),
        subscription:
          entry.live && op.kind === "query"
            ? makeSubscription(op, {
                fields: entry.live === true ? undefined : entry.live.fields,
              })
            : undefined,
      };
      if (entry.path !== undefined) {
        const route = routeKey(method, entry.path);
        const other = byRoute.get(route);
        if (other) {
          throw new DefinitionError(
            `${method} ${entry.path} is used by both ${other.group}.${other.name} and ${group}.${op.name}`,
          );
        }
        byRoute.set(route, resolved);
      }
      entries.push(resolved);
      byOp.set(op, resolved);
      byName.set(`${group}\u0000${op.name}`, resolved);
    }
  }
  return {
    kind: "endpoints",
    groups,
    mark,
    entries,
    entryOf: (op) => byOp.get(op),
    entryByName: (group, name) => byName.get(`${group}\u0000${name}`),
  };
};

/**
 * 認証コンテキストの型を、アプリ全体で 1 回だけ宣言する。
 * 返す `createOps` と `override` は、`ctx` の型をこの型に決める。
 * 返す `defineEndpoints` は、同じ `defineContext` の `createOps` で作った操作だけを受け付ける（型と実行時の両方）。
 */
export const defineContext = <TAuth>() => {
  const mark = newContextMark();
  return {
    ...contextParts<TAuth>(mark),
    defineEndpoints: <const G extends EndpointGroups>(
      groups: G & CheckGroups<G, TAuth>,
    ): Endpoints<G> => buildEndpoints(groups, mark),
  };
};

/** 購読のメッセージでの識別子（`グループ名.操作の名前`） */
export const subscriptionId = (entry: ResolvedEntry): string =>
  `${entry.group}.${entry.name}`;

/** 購読の識別子を、グループ名と操作の名前に分ける */
export const parseSubscriptionId = (
  id: string,
): { group: string; name: string } | undefined => {
  const i = id.indexOf(".");
  if (i <= 0 || i === id.length - 1) return undefined;
  return { group: id.slice(0, i), name: id.slice(i + 1) };
};

/** `can` の結果 */
export type CanResult =
  | { ok: true }
  | {
      ok: false;
      reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT";
      issues?: z.core.$ZodIssue[];
    };
