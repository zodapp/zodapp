import type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";

/**
 * Firestore のクエリ演算子（Firebase に依存しない独自定義）
 */
export type WhereFilterOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "in"
  | "array-contains-any"
  | "not-in";

/**
 * クエリ条件の型定義
 */
export type WhereParams = {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
};

/**
 * orderBy 指定のパラメータ。
 *
 * `QueryOptions.orderBy` で使用します。
 */
export type OrderByParams = {
  field: string;
  direction: "asc" | "desc";
};

/**
 * Firestore クエリ条件のオプション。
 *
 * `where` と `orderBy` を組み合わせてクエリを組み立てます。
 */
export type QueryOptions = {
  where?: WhereParams[];
  orderBy?: OrderByParams[];
};

/**
 * query 関数の型（常に関数）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFn = (...args: any[]) => QueryOptions;

export type CollectionQueries<
  TCollection extends LooseCollectionConfigBase,
  Queries extends Record<string, QueryFn> = Record<string, never>,
> = {
  readonly collection: TCollection;
  readonly queries: Queries;
};

export interface CollectionQueriesBase {
  readonly collection: CollectionConfigBase;
  readonly queries: Record<string, QueryFn>;
}

export interface LooseCollectionQueriesBase {
  readonly collection: LooseCollectionConfigBase;
  readonly queries: Record<string, QueryFn>;
}

export const createCollectionQueries = <
  const TCollection extends LooseCollectionConfigBase,
  const Queries extends Record<string, QueryFn>,
>(
  collection: TCollection,
  queries: Queries,
): CollectionQueries<TCollection, Queries> => ({
  collection,
  queries,
});
