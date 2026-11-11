import type { z } from "zod";
import { DefinitionError } from "./errors";
import { assertReparseable } from "./schema";
import type { MutationDef } from "./mutation";
import {
  buildQuery,
  type QueryDef,
  type QueryResultOf,
  type QuerySelect,
  type QueryWhere,
  type RawQuerySpec,
} from "./query";
import {
  buildSearch,
  type SearchDef,
  type SearchFilters,
  type SearchResultOf,
  type VectorNames,
  type VectorPartition,
} from "./search";
import type { AnyTableConfig, CreateOf, ItemOf, TableKey } from "./table";
import type { VectorRuntimeConfig } from "./vector";
import type {
  FieldType,
  IndexedVariant,
  NumericField,
  PatchOf,
  Simplify,
} from "./types";
import type { WhereOf } from "./where";

// ---- 操作の型 ----

/** 認可の関数。`true` を返せば許可。共有の定義では同期の関数に限る */
export type AuthorizeFn<TAuth, TReq> = (ctx: TAuth, req: TReq) => boolean;

/** 操作の種類ごとの、認可が受け取るリクエスト */
export type GetRequest<TT extends AnyTableConfig> = { key: TableKey<TT> };
export type CreateRequest<TT extends AnyTableConfig> = {
  key: TableKey<TT>;
  input: CreateOf<TT>;
};
/** キーを生成する作成。`args` は `tableConfig` の `generateKey.args` の値 */
export type CreateWithGeneratedKeyRequest<TT extends AnyTableConfig> = {
  args: GenerateArgsOf<TT>;
  input: CreateOf<TT>;
};
/** 全体の置き換え */
export type SetRequest<TT extends AnyTableConfig> = {
  key: TableKey<TT>;
  input: ItemOf<TT>;
};
/** `tableConfig` の `generateKey.args` の値の型 */
export type GenerateArgsOf<TT extends AnyTableConfig> =
  TT["generateKey"] extends
    ((args: infer A, input: never) => unknown) | undefined
    ? A
    : never;
export type DeleteRequest<TT extends AnyTableConfig> = { key: TableKey<TT> };
export type MutationRequest<TT extends AnyTableConfig, TParams> = {
  key: TableKey<TT>;
  params: TParams;
};
export type QueryRequest<TParams> = { params: TParams };

type OpMarks<TAuth, TA> = {
  /** 認可の関数。`undefined` ならサーバー専用の操作 */
  readonly authorize: TA;
  /** 型だけの情報：認証コンテキストの型 */
  readonly $auth: TAuth;
};

export type GetOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TAuth = any,
  TA = unknown,
> = {
  readonly kind: "get";
  readonly table: TT;
  readonly name: string;
} & OpMarks<TAuth, TA>;

export type CreateOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TAuth = any,
  TA = unknown,
> = {
  readonly kind: "create";
  readonly table: TT;
  readonly name: string;
} & OpMarks<TAuth, TA>;

export type CreateWithGeneratedKeyOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TAuth = any,
  TA = unknown,
> = {
  readonly kind: "createWithGeneratedKey";
  readonly table: TT;
  readonly name: string;
} & OpMarks<TAuth, TA>;

export type SetOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TAuth = any,
  TA = unknown,
> = {
  readonly kind: "set";
  readonly table: TT;
  readonly name: string;
} & OpMarks<TAuth, TA>;

export type DeleteOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TAuth = any,
  TA = unknown,
> = {
  readonly kind: "delete";
  readonly table: TT;
  readonly name: string;
  /** 削除の条件。DynamoDB が削除と同じリクエストで評価する */
  readonly where:
    | ((params: Record<string, never>, ctx: TAuth) => WhereOf<ItemOf<TT>>)
    | undefined;
} & OpMarks<TAuth, TA>;

export type MutationOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TAuth = any,
  TA = unknown,
> = MutationDef<TT, TParams, TAuth> & OpMarks<TAuth, TA>;

export type QueryOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown,
  TAuth = any,
  TIndexFields extends string = string,
  TA = unknown,
> = QueryDef<TT, TParams, TResult, TAuth, TIndexFields> & OpMarks<TAuth, TA>;

/** 検索で、Repository が `partition` から引いて渡す実行時の設定 */
export type SearchRuntime = { vectorConfig: VectorRuntimeConfig | undefined };

export type SearchOp<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown,
  TAuth = any,
  TVector extends string = string,
  TA = unknown,
> = SearchDef<TT, TParams, TResult, TAuth, TVector> & OpMarks<TAuth, TA>;

export type AnyOp =
  | GetOp<any, any, any>
  | CreateOp<any, any, any>
  | CreateWithGeneratedKeyOp<any, any, any>
  | SetOp<any, any, any>
  | DeleteOp<any, any, any>
  | MutationOp<any, any, any, any>
  | QueryOp<any, any, any, any, any, any>
  | SearchOp<any, any, any, any, any, any>;

/** 認可の関数を持つか（持たなければサーバー専用） */
export type IsPublicOp<O> = O extends { authorize: (...args: any[]) => any }
  ? true
  : false;

/**
 * `defineContext` を呼ぶたびに 1 つ作る目印。
 * 実行時に、別の `defineContext` の操作が混ざっていないかを確かめるのに使う
 */
export type ContextMark = { readonly kind: "context"; readonly id: symbol };

/** `createOps` で作った操作と、その `defineContext` の目印（`isOp` の判定にも使う） */
const OPS = new WeakMap<AnyOp, ContextMark>();

export const isOp = (value: unknown): value is AnyOp =>
  value !== null && typeof value === "object" && OPS.has(value as AnyOp);

/** 操作を作った `defineContext` の目印。`createOps` で作っていなければ `undefined` */
export const contextMarkOf = (op: AnyOp): ContextMark | undefined =>
  OPS.get(op);

// ---- Index の情報（query.ts と同じもの） ----

type IndexNames<TT extends AnyTableConfig> = keyof TT["indexes"] & string;
type IndexPartition<TT extends AnyTableConfig, I> =
  I extends IndexNames<TT>
    ? TT["indexes"][I]["partition"]
    : TT["key"]["partition"];
type IndexSort<TT extends AnyTableConfig, I> =
  I extends IndexNames<TT>
    ? TT["indexes"][I] extends { sort: infer S extends readonly string[] }
      ? S
      : []
    : TT["key"]["sort"];
type IndexFields<TT extends AnyTableConfig, I> =
  IndexPartition<TT, I>[number] | IndexSort<TT, I>[number];

// ---- 組み立て ----

type DeleteSpec<TT extends AnyTableConfig, TAuth> = {
  where?: (params: Record<string, never>, ctx: TAuth) => WhereOf<ItemOf<TT>>;
};

type MutationSpec<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  TAuth,
> = {
  params: TParams;
  /** パラメーターから部分更新を作る */
  patch?: (params: z.output<TParams>, ctx: TAuth) => PatchOf<ItemOf<TT>>;
  /** 数値のフィールドへの原子的な加算 */
  add?: (
    params: z.output<TParams>,
    ctx: TAuth,
  ) => { [K in NumericField<ItemOf<TT>>]?: number };
  /** 書き込みの条件。書き込みと同じリクエストで DynamoDB が評価する */
  where?: (params: z.output<TParams>, ctx: TAuth) => WhereOf<ItemOf<TT>>;
  ifUnchanged?: "required" | "optional";
};

type QuerySpec<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  I,
  TSelect extends QuerySelect,
  TAuth,
> = {
  index?: I;
  params: TParams;
  where: (
    params: z.output<TParams>,
    ctx: TAuth,
  ) => QueryWhere<
    IndexedVariant<ItemOf<TT>, IndexFields<TT, I> & string>,
    IndexPartition<TT, I>,
    IndexSort<TT, I>
  >;
  direction?: "asc" | "desc";
  select?: TSelect;
  limit?: number;
};

type QueryOpOf<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  I,
  TSelect extends QuerySelect,
  TAuth,
  TA,
> = QueryOp<
  TT,
  TParams,
  QueryResultOf<TT, I & (IndexNames<TT> | undefined), TSelect>,
  TAuth,
  IndexFields<TT, I> & string,
  TA
>;

type SearchSpec<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  V extends VectorNames<TT>,
  TSelect extends QuerySelect,
  TAuth,
> = {
  vector: V;
  params: TParams;
  /** 100 以下 */
  topK: number;
  select?: TSelect;
  /** `HASH` を構成するフィールドすべてに値を与える */
  partition: (
    params: z.output<TParams>,
    ctx: TAuth,
  ) => Simplify<{
    [K in VectorPartition<TT, V>]: Exclude<FieldType<ItemOf<TT>, K>, undefined>;
  }>;
  /**
   * `INLINE_FILTER` による等値の絞り込み。サーバーでだけ呼ばれ、
   * `vectorConfig` には `partition` から引いた実行時の設定が入る
   */
  filters?: (
    params: z.output<TParams>,
    ctx: TAuth,
    runtime: SearchRuntime,
  ) => SearchFilters;
};

/**
 * 操作を組み立てる関数。`authorize` を書いたかどうかを型に残すため、
 * 「`authorize` あり」と「なし（サーバー専用）」の 2 つの形を持つ
 */
type OpsBuilder<TT extends AnyTableConfig, TAuth> = {
  /** Item 1 件の取得 */
  get(def: {
    authorize: AuthorizeFn<TAuth, GetRequest<TT>>;
  }): GetOp<TT, TAuth, AuthorizeFn<TAuth, GetRequest<TT>>>;
  get(def?: { authorize?: undefined }): GetOp<TT, TAuth, undefined>;
  /** キーを指定した作成 */
  create(def: {
    authorize: AuthorizeFn<TAuth, CreateRequest<TT>>;
  }): CreateOp<TT, TAuth, AuthorizeFn<TAuth, CreateRequest<TT>>>;
  create(def?: { authorize?: undefined }): CreateOp<TT, TAuth, undefined>;
  /** キーを生成する作成（`tableConfig` の `generateKey` を使う） */
  createWithGeneratedKey(def: {
    authorize: AuthorizeFn<TAuth, CreateWithGeneratedKeyRequest<TT>>;
  }): CreateWithGeneratedKeyOp<
    TT,
    TAuth,
    AuthorizeFn<TAuth, CreateWithGeneratedKeyRequest<TT>>
  >;
  createWithGeneratedKey(def?: {
    authorize?: undefined;
  }): CreateWithGeneratedKeyOp<TT, TAuth, undefined>;
  /** Item 全体の置き換え */
  set(def: {
    authorize: AuthorizeFn<TAuth, SetRequest<TT>>;
  }): SetOp<TT, TAuth, AuthorizeFn<TAuth, SetRequest<TT>>>;
  set(def?: { authorize?: undefined }): SetOp<TT, TAuth, undefined>;
  /** 削除。`where` を付けると、条件を満たすときだけ削除する */
  delete(
    def: DeleteSpec<TT, TAuth> & {
      authorize: AuthorizeFn<TAuth, DeleteRequest<TT>>;
    },
  ): DeleteOp<TT, TAuth, AuthorizeFn<TAuth, DeleteRequest<TT>>>;
  delete(
    def?: DeleteSpec<TT, TAuth> & { authorize?: undefined },
  ): DeleteOp<TT, TAuth, undefined>;
  /** 名前付きミューテーション（部分更新） */
  mutation<TParams extends z.ZodType>(
    def: MutationSpec<TT, TParams, TAuth> & {
      authorize: AuthorizeFn<TAuth, MutationRequest<TT, z.output<TParams>>>;
    },
  ): MutationOp<
    TT,
    TParams,
    TAuth,
    AuthorizeFn<TAuth, MutationRequest<TT, z.output<TParams>>>
  >;
  mutation<TParams extends z.ZodType>(
    def: MutationSpec<TT, TParams, TAuth> & { authorize?: undefined },
  ): MutationOp<TT, TParams, TAuth, undefined>;
  /** 名前付きクエリ */
  query<
    TParams extends z.ZodType,
    const I extends IndexNames<TT> | undefined = undefined,
    const TSelect extends QuerySelect = "full",
  >(
    def: QuerySpec<TT, TParams, I, TSelect, TAuth> & {
      authorize: AuthorizeFn<TAuth, QueryRequest<z.output<TParams>>>;
    },
  ): QueryOpOf<
    TT,
    TParams,
    I,
    TSelect,
    TAuth,
    AuthorizeFn<TAuth, QueryRequest<z.output<TParams>>>
  >;
  query<
    TParams extends z.ZodType,
    const I extends IndexNames<TT> | undefined = undefined,
    const TSelect extends QuerySelect = "full",
  >(
    def: QuerySpec<TT, TParams, I, TSelect, TAuth> & { authorize?: undefined },
  ): QueryOpOf<TT, TParams, I, TSelect, TAuth, undefined>;
  /**
   * 名前付きの検索（ベクトル検索）。検索用のベクトル（`queryVector`）は、
   * サーバーの上書き（`override`）で付ける
   */
  search<
    TParams extends z.ZodType,
    const V extends VectorNames<TT>,
    const TSelect extends QuerySelect = "full",
  >(
    def: SearchSpec<TT, TParams, V, TSelect, TAuth> & {
      authorize: AuthorizeFn<TAuth, QueryRequest<z.output<TParams>>>;
    },
  ): SearchOp<
    TT,
    TParams,
    SearchResultOf<TT, V, TSelect>,
    TAuth,
    V,
    AuthorizeFn<TAuth, QueryRequest<z.output<TParams>>>
  >;
  search<
    TParams extends z.ZodType,
    const V extends VectorNames<TT>,
    const TSelect extends QuerySelect = "full",
  >(
    def: SearchSpec<TT, TParams, V, TSelect, TAuth> & { authorize?: undefined },
  ): SearchOp<TT, TParams, SearchResultOf<TT, V, TSelect>, TAuth, V, undefined>;
};

/** `createOps` の戻り値：各操作にキーの名前をリテラル型で付ける */
export type Ops<D> = {
  [K in keyof D]: D[K] & { readonly name: K & string };
};

const checkAuthorize = (name: string, authorize: unknown) => {
  if (authorize !== undefined && typeof authorize !== "function") {
    throw new DefinitionError(
      `operation "${name}": authorize must be a function`,
    );
  }
};

const makeCreateOps =
  <TAuth>(mark: ContextMark) =>
  <TT extends AnyTableConfig, D extends Record<string, AnyOp>>(
    table: TT,
    build: (o: OpsBuilder<TT, TAuth>) => D,
  ): Ops<D> => {
    const o = {
      get: (def: { authorize?: unknown } = {}) =>
        ({
          kind: "get",
          table,
          name: "",
          authorize: def.authorize,
          $auth: undefined as never,
        }) as never,
      create: (def: { authorize?: unknown } = {}) =>
        ({
          kind: "create",
          table,
          name: "",
          authorize: def.authorize,
          $auth: undefined as never,
        }) as never,
      createWithGeneratedKey: (def: { authorize?: unknown } = {}) => {
        if (!table.generateKey || !table.generateKeyArgs) {
          throw new DefinitionError(
            `entity "${table.entity}": createWithGeneratedKey needs generateKey in tableConfig`,
          );
        }
        return {
          kind: "createWithGeneratedKey",
          table,
          name: "",
          authorize: def.authorize,
          $auth: undefined as never,
        };
      },
      set: (def: { authorize?: unknown } = {}) => ({
        kind: "set",
        table,
        name: "",
        authorize: def.authorize,
        $auth: undefined as never,
      }),
      delete: (def: { authorize?: unknown; where?: unknown } = {}) =>
        ({
          kind: "delete",
          table,
          name: "",
          authorize: def.authorize,
          where: def.where,
          $auth: undefined as never,
        }) as never,
      mutation: (def: Record<string, any>) =>
        ({
          kind: "mutation",
          table,
          name: "",
          params: def.params,
          patch: def.patch,
          add: def.add,
          where: def.where,
          ifUnchanged: def.ifUnchanged,
          authorize: def.authorize,
          $auth: undefined as never,
        }) as never,
      search: (def: Record<string, any>) => {
        const filters = def.filters as
          | ((
              p: unknown,
              ctx: unknown,
              runtime: SearchRuntime,
            ) => SearchFilters)
          | undefined;
        return {
          ...buildSearch(table, def as never),
          partition: def.partition,
          // Repository は (params, { ...ctx, vectorConfig }) で呼ぶ
          filters: filters
            ? (p: unknown, ctx: { vectorConfig?: VectorRuntimeConfig }) =>
                filters(p, ctx, { vectorConfig: ctx?.vectorConfig })
            : undefined,
          authorize: def.authorize,
          $auth: undefined as never,
        };
      },
      query: (def: Record<string, any>) =>
        ({
          ...buildQuery(table, def as unknown as RawQuerySpec),
          authorize: def.authorize,
          $auth: undefined as never,
        }) as never,
    };
    const ops = build(o as unknown as OpsBuilder<TT, TAuth>);
    for (const [name, op] of Object.entries(ops)) {
      if (op === null || typeof op !== "object" || op.table !== table) {
        throw new DefinitionError(
          `operation "${name}" must be built with the builder of createOps`,
        );
      }
      checkAuthorize(name, op.authorize);
      const params = (op as { params?: unknown }).params;
      if (params !== undefined) {
        assertReparseable(params as z.ZodType, `operation "${name}" params`);
      }
      (op as { name: string }).name = name;
      OPS.set(op, mark);
    }
    return ops as Ops<D>;
  };

// ---- サーバーの上書き ----

/** 上書きで受け取る、共有の関数 */
type SharedAuthorize<TAuth, TReq> = (ctx: TAuth, req: TReq) => boolean;

export type RequestOf<O> =
  O extends GetOp<infer TT>
    ? GetRequest<TT>
    : O extends CreateOp<infer TT>
      ? CreateRequest<TT>
      : O extends CreateWithGeneratedKeyOp<infer TT>
        ? CreateWithGeneratedKeyRequest<TT>
        : O extends SetOp<infer TT>
          ? SetRequest<TT>
          : O extends DeleteOp<infer TT>
            ? DeleteRequest<TT>
            : O extends MutationOp<infer TT, infer TParams>
              ? MutationRequest<TT, z.output<TParams>>
              : O extends QueryOp<any, infer TParams>
                ? QueryRequest<z.output<TParams>>
                : O extends SearchOp<any, infer TParams>
                  ? QueryRequest<z.output<TParams>>
                  : never;

/**
 * サーバーだけで足す実装（ブラウザに出したくない規則、サーバー専用の処理）。
 * 共有の関数は最後の引数 `shared` で受け取る。呼ばなければ置き換えになる。
 */
export type OverrideImpl<O, TAuth> = {
  /**
   * 認可。同期の関数だけ（データベースは読まない）。認可に要るデータは、認証コンテキストを作るときに読む。
   * HTTP・リアルタイムの配信のたびに呼ばれる
   */
  authorize?: (
    ctx: TAuth,
    req: RequestOf<O>,
    shared: SharedAuthorize<TAuth, RequestOf<O>>,
  ) => boolean;
} & (O extends MutationOp<infer TT, infer TParams>
  ? {
      patch?: (
        params: z.output<TParams>,
        ctx: TAuth,
        shared: (params: z.output<TParams>, ctx: TAuth) => PatchOf<ItemOf<TT>>,
      ) => PatchOf<ItemOf<TT>> | Promise<PatchOf<ItemOf<TT>>>;
      where?: (
        params: z.output<TParams>,
        ctx: TAuth,
        shared: (params: z.output<TParams>, ctx: TAuth) => WhereOf<ItemOf<TT>>,
      ) => WhereOf<ItemOf<TT>> | Promise<WhereOf<ItemOf<TT>>>;
    }
  : O extends SearchOp<any, infer TParams>
    ? {
        /** 検索用の embedding ベクトル。外部の API を呼ぶことが多いので、サーバーだけに書く */
        queryVector?: (
          params: z.output<TParams>,
          ctx: TAuth,
          runtime: SearchRuntime,
        ) => readonly number[] | Promise<readonly number[]>;
      }
    : O extends DeleteOp<infer TT>
      ? {
          where?: (
            params: Record<string, never>,
            ctx: TAuth,
            shared: (
              params: Record<string, never>,
              ctx: TAuth,
            ) => WhereOf<ItemOf<TT>>,
          ) => WhereOf<ItemOf<TT>> | Promise<WhereOf<ItemOf<TT>>>;
        }
      : {});

export type Override = {
  readonly kind: "override";
  /** 上書きを作った `defineContext` の目印 */
  readonly mark: ContextMark;
  readonly op: AnyOp;
  readonly impl: OverrideImpl<any, any>;
};

const makeOverride =
  <TAuth>(mark: ContextMark) =>
  <O extends AnyOp>(op: O, impl: OverrideImpl<O, TAuth>): Override => {
    if (!isOp(op)) {
      throw new DefinitionError(
        "override() takes an operation made by createOps",
      );
    }
    if (OPS.get(op) !== mark) {
      throw new DefinitionError(
        `override() of operation "${op.name}": operations from different defineContext calls are mixed`,
      );
    }
    return {
      kind: "override",
      mark,
      op,
      impl: impl as OverrideImpl<any, any>,
    };
  };

/** @internal `defineContext` の目印を作る（register.ts の `defineContext` が使う） */
export const newContextMark = (): ContextMark => ({
  kind: "context",
  id: Symbol("defineContext"),
});

/** @internal `defineContext` の中身（`createOps` と `override`）。`defineEndpoints` は register.ts で足す */
export const contextParts = <TAuth>(mark: ContextMark) => ({
  createOps: makeCreateOps<TAuth>(mark),
  override: makeOverride<TAuth>(mark),
});
