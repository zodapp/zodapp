import type { z } from "zod";
import type { FieldsInput } from "./endpoint";
import type {
  CreateOp,
  CreateWithGeneratedKeyOp,
  GenerateArgsOf,
  SetOp,
  DeleteOp,
  GetOp,
  IsPublicOp,
  MutationOp,
  QueryOp,
  SearchOp,
} from "./ops";
import type {
  CanResult,
  EndpointEntry,
  EndpointGroups,
  Endpoints,
} from "./register";
import type { AnyTableConfig, ItemOf, TableKey } from "./table";

// ---- 一覧の store（ブラウザの `live` と React の hook が使う） ----

/** 一覧の状態。1 回きりの取得とリアルタイムで同じ形 */
export type ListState<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
  /** まだ読んでいない古いページがあるか（progressive） */
  hasMore: boolean;
  /** `fetchMore` の途中か */
  isFetchingMore: boolean;
  /** 最後に起きたエラー。`status` が `"ready"` のままのこともある（`fetchMore` の失敗など） */
  error?: Error;
};

export type ListStore<T> = {
  getState(): ListState<T>;
  /** 状態が変わるたびに呼ばれる。戻り値で登録を解除する */
  subscribe(listener: () => void): () => void;
  /** 次のページを読む（progressive）。読むものがなければ何もしない */
  fetchMore(): void;
  /** 最初から読み直す */
  reload(): void;
  /** 終える。以降は状態が変わらない */
  close(): void;
};

export type ListOptions = {
  /**
   * progressive にする。最初にこの件数を読み、`fetchMore` で同じ件数ずつ遡る。
   * 省略すると最後のページまで読む（全体）
   */
  pageSize?: number;
  /** 全体を読むときの件数の上限。超えたら `TOO_MANY_ITEMS` のエラー。既定は 10,000 */
  maxSnapshotItems?: number;
};

export type LiveListOptions<TAuth = unknown> = ListOptions & {
  /**
   * 一括での書き込みの扱い。`"apply"`（既定）は個々の変更を適用する。
   * `"reload"` は開始から終了までの変更を適用せずに待ち、終了で読み直す
   */
  onBatch?: "apply" | "reload";
  /** 認証コンテキスト。省略するとグローバルな値を使う */
  context?: TAuth;
};

// ---- 呼び出しの引数 ----

/** 認証コンテキストを明示するときの引数 */
export type ContextOption<TAuth> = {
  /**
   * 認証コンテキスト。省略すると、サーバーではスコープ、ブラウザではグローバルな値を使う
   */
  context?: TAuth;
  /** ブラウザだけ：リクエストの中止 */
  signal?: AbortSignal;
  /** ブラウザだけ：この呼び出しだけに付けるヘッダー */
  headers?: Record<string, string>;
};

/** `can` の引数。`item` を渡すと `where` も判定する */
export type CanOptions<TAuth, TItem> = ContextOption<TAuth> & { item?: TItem };

export type QueryCallOptions<
  TAuth,
  TT extends AnyTableConfig,
> = ContextOption<TAuth> & {
  cursor?: string;
  limit?: number;
  fields?: FieldsInput<TT>;
};

export type QueryPage<TItem> = { items: TItem[]; cursor?: string };

/** `withToken: true` の Get の戻り値 */
export type ItemWithToken<TItem> = { item: TItem | null; token?: string };

// ---- 操作ごとの関数 ----

/**
 * API の側。ブラウザ（HTTP 越し）か、サーバー（直接）か、両側で使える共通の形（`SharedApi`）
 */
export type Side = "browser" | "server" | "shared";

type AuthOf<O> = O extends { readonly $auth: infer A } ? A : never;

type GetFn<TT extends AnyTableConfig, TAuth> = {
  (
    key: TableKey<TT>,
    options?: ContextOption<TAuth> & { withToken?: false },
  ): Promise<ItemOf<TT> | null>;
  // `withToken: true` の形を後ろに置く（関数の型から推論するときは、最後の形が使われる）
  (
    key: TableKey<TT>,
    options: ContextOption<TAuth> & { withToken: true },
  ): Promise<ItemWithToken<ItemOf<TT>>>;
};
type GetCan<TT extends AnyTableConfig, TAuth> = {
  can(key: TableKey<TT>, options?: ContextOption<TAuth>): CanResult;
};

type CreateFn<TT extends AnyTableConfig, TAuth> = (
  key: TableKey<TT>,
  input: z.input<TT["create"]>,
  options?: ContextOption<TAuth>,
) => Promise<ItemOf<TT>>;
type CreateCan<TT extends AnyTableConfig, TAuth> = {
  can(
    key: TableKey<TT>,
    input: z.input<TT["create"]>,
    options?: ContextOption<TAuth>,
  ): CanResult;
};

type CreateWithGeneratedKeyFn<TT extends AnyTableConfig, TAuth> = (
  args: GenerateArgsOf<TT>,
  input: z.input<TT["create"]>,
  options?: ContextOption<TAuth>,
) => Promise<ItemOf<TT>>;
type CreateWithGeneratedKeyCan<TT extends AnyTableConfig, TAuth> = {
  can(
    args: GenerateArgsOf<TT>,
    input: z.input<TT["create"]>,
    options?: ContextOption<TAuth>,
  ): CanResult;
};

type SetFn<TT extends AnyTableConfig, TAuth> = (
  key: TableKey<TT>,
  input: z.input<TT["item"]>,
  options?: ContextOption<TAuth>,
) => Promise<ItemOf<TT>>;
type SetCan<TT extends AnyTableConfig, TAuth> = {
  can(
    key: TableKey<TT>,
    input: z.input<TT["item"]>,
    options?: ContextOption<TAuth>,
  ): CanResult;
};

/**
 * 削除。サーバーでは削除前の Item を返す（ブラウザには返さない）。
 * 両側で使う形では、戻り値に頼らない（`unknown`）
 */
type DeleteFn<TT extends AnyTableConfig, TAuth, S extends Side> = (
  key: TableKey<TT>,
  options?: ContextOption<TAuth>,
) => Promise<
  S extends "server" ? ItemOf<TT> | null : S extends "browser" ? void : unknown
>;
type DeleteCan<TT extends AnyTableConfig, TAuth> = {
  can(key: TableKey<TT>, options?: CanOptions<TAuth, ItemOf<TT>>): CanResult;
};

type MutationFn<TT extends AnyTableConfig, TParams extends z.ZodType, TAuth> = (
  key: TableKey<TT>,
  params: z.input<TParams>,
  options?: ContextOption<TAuth> & { ifUnchanged?: string },
) => Promise<ItemOf<TT>>;
type MutationCan<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  TAuth,
> = {
  can(
    key: TableKey<TT>,
    params: z.input<TParams>,
    options?: CanOptions<TAuth, ItemOf<TT>>,
  ): CanResult;
};

type QueryFn<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  TResult,
  TAuth,
> = (
  params: z.input<TParams>,
  options?: QueryCallOptions<TAuth, TT>,
) => Promise<QueryPage<TResult>>;
type QueryPages<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  TResult,
  TAuth,
> = {
  /** `cursor` を引き継ぎながら、最後のページまで順に取る */
  pages(
    params: z.input<TParams>,
    options?: QueryCallOptions<TAuth, TT>,
  ): AsyncIterable<QueryPage<TResult>>;
};
type QueryCan<TParams extends z.ZodType, TResult, TAuth> = {
  can(
    params: z.input<TParams>,
    options?: CanOptions<TAuth, TResult>,
  ): CanResult;
};
type QueryLive<TParams extends z.ZodType, TResult, TAuth> = {
  /** リアルタイムの一覧。登録簿で `live` を付けたクエリだけ */
  live(
    params: z.input<TParams>,
    options?: LiveListOptions<TAuth>,
  ): ListStore<TResult>;
};

type SearchFn<
  TT extends AnyTableConfig,
  TParams extends z.ZodType,
  TResult,
  TAuth,
> = (
  params: z.input<TParams>,
  options?: ContextOption<TAuth> & { fields?: FieldsInput<TT> },
) => Promise<TResult[]>;
type SearchCan<TParams extends z.ZodType, TAuth> = {
  can(params: z.input<TParams>, options?: ContextOption<TAuth>): CanResult;
};

/** 型だけの情報：関数が表す操作。両側で使う形は、どちらの側の関数も受け入れる */
type FnMarks<O, S extends Side> = {
  readonly op: O;
  readonly $side: S extends "shared" ? "browser" | "server" : S;
};

/** 1 つのエントリーから、API の関数の型を作る */
export type ApiFunction<E, S extends Side> = E extends {
  readonly op: infer O;
}
  ? FnMarks<O, S> &
      (O extends GetOp<infer TT>
        ? Callable<E, S, GetFn<TT, AuthOf<O>>> & GetCan<TT, AuthOf<O>>
        : O extends CreateOp<infer TT>
          ? Callable<E, S, CreateFn<TT, AuthOf<O>>> & CreateCan<TT, AuthOf<O>>
          : O extends CreateWithGeneratedKeyOp<infer TT>
            ? Callable<E, S, CreateWithGeneratedKeyFn<TT, AuthOf<O>>> &
                CreateWithGeneratedKeyCan<TT, AuthOf<O>>
            : O extends SetOp<infer TT>
              ? Callable<E, S, SetFn<TT, AuthOf<O>>> & SetCan<TT, AuthOf<O>>
              : O extends DeleteOp<infer TT>
                ? Callable<E, S, DeleteFn<TT, AuthOf<O>, S>> &
                    DeleteCan<TT, AuthOf<O>>
                : O extends MutationOp<infer TT, infer TParams>
                  ? Callable<E, S, MutationFn<TT, TParams, AuthOf<O>>> &
                      MutationCan<TT, TParams, AuthOf<O>>
                  : O extends QueryOp<infer TT, infer TParams, infer TResult>
                    ? Callable<
                        E,
                        S,
                        QueryFn<TT, TParams, TResult, AuthOf<O>> &
                          QueryPages<TT, TParams, TResult, AuthOf<O>>
                      > &
                        QueryCan<TParams, TResult, AuthOf<O>> &
                        (S extends "browser"
                          ? E extends { readonly live: true | object }
                            ? QueryLive<TParams, TResult, AuthOf<O>>
                            : {}
                          : {})
                    : O extends SearchOp<infer TT, infer TParams, infer TResult>
                      ? Callable<
                          E,
                          S,
                          SearchFn<TT, TParams, TResult, AuthOf<O>>
                        > &
                          SearchCan<TParams, AuthOf<O>>
                      : never)
  : never;

/**
 * 関数として呼べるか。サーバーでは常に呼べる。ブラウザと両側で使う形では `path` があるときだけ
 * （`live` だけのクエリは `live` と `can` だけを持つ）
 */
type Callable<E, S extends Side, F> = S extends "server"
  ? F
  : E extends { readonly path: string }
    ? F
    : {};

/** ブラウザから見えるエントリー（`authorize` を持ち、`path` か `live` がある） */
type BrowserVisible<E> = E extends { readonly op: infer O }
  ? IsPublicOp<O> extends true
    ? E extends { readonly path: string } | { readonly live: true | object }
      ? true
      : false
    : false
  : false;

/** 両側で使える形に入るエントリー（`authorize` と `path` を持つ） */
type SharedVisible<E> = E extends { readonly op: infer O }
  ? IsPublicOp<O> extends true
    ? E extends { readonly path: string }
      ? true
      : false
    : false
  : false;

type NameOf<E> = E extends {
  readonly op: { readonly name: infer N extends string };
}
  ? N
  : never;

type GroupApi<L extends readonly EndpointEntry[], S extends Side> = {
  [
    E in L[number] as S extends "server"
      ? NameOf<E>
      : (S extends "shared" ? SharedVisible<E> : BrowserVisible<E>) extends true
        ? NameOf<E>
        : never
  ]: ApiFunction<E, S>;
};

type GroupsOf<E> = E extends Endpoints<infer G> ? G : never;

/** 登録簿から作る、ブラウザの API（`createClient` の戻り値） */
export type Api<E extends Endpoints<any>> = {
  readonly [K in keyof GroupsOf<E>]: GroupApi<GroupsOf<E>[K], "browser">;
};

/** 登録簿から作る、サーバーの API（`createServerApi` の戻り値）。サーバー専用の操作も含む */
export type ServerApi<E extends Endpoints<any>> = {
  readonly [K in keyof GroupsOf<E>]: GroupApi<GroupsOf<E>[K], "server">;
};

/**
 * ブラウザの API とサーバーの API のどちらも渡せる、共通の形。ブラウザとサーバーで共有するコードの引数に使う。
 * ブラウザで呼べる操作（`authorize` と `path` を持つもの）だけを含み、`live` は含まない
 *
 * ```ts
 * export const finishAll = async (api: SharedApi<typeof endpoints>, workspaceId: string) => { … };
 * ```
 */
export type SharedApi<E extends Endpoints<any>> = {
  readonly [K in keyof GroupsOf<E>]: GroupApi<GroupsOf<E>[K], "shared">;
};

/** API の関数から、その操作を取り出す（`createUseList(api.tasks.byStatus)` などが使う） */
export type OpOf<F> = F extends FnMarks<infer O, any> ? O : never;

/** 登録簿のグループの型 */
export type { EndpointGroups };
