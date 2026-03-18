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

// ---------------------------------------------------------------------------
// autoQuery helpers
// ---------------------------------------------------------------------------

type AutoQueryConfig = Pick<CollectionConfigBase, "nonPathKeys">;

/**
 * `collectionIdentity` の nonPath keys から `field == value` の where 句を生成する。
 *
 * pathFieldKeys（path にも含まれる fieldKeys）は対象外。
 * `config.nonPathKeys` を直接参照する。
 */
const buildAutoWhereFromIdentity = (
  config: AutoQueryConfig,
  collectionIdentity: Record<string, unknown>,
): WhereParams[] => {
  return config.nonPathKeys.map((key) => ({
    field: key,
    operator: "==" as const,
    value: collectionIdentity[key],
  }));
};

/**
 * autoQuery where と明示 where を合成し、正規化された `QueryOptions` を返す。
 *
 * - nonPath keys 由来の auto where は常に適用される（`explicitQuery` が `undefined` でも）
 * - 明示 where に auto 対象 field の `==` 同値が含まれていれば重複排除する
 * - auto 対象 field に対する別値の `==` / 非 `==` 演算子は早期エラーにする
 * - `where: []` でも auto scope は解除されない
 * - `orderBy` はそのまま保持する
 */
export const resolveScopedQueryOptions = (
  config: AutoQueryConfig,
  collectionIdentity: Record<string, unknown>,
  explicitQuery: QueryOptions | undefined,
): QueryOptions => {
  const autoWhere = buildAutoWhereFromIdentity(config, collectionIdentity);

  if (autoWhere.length === 0) {
    return {
      where: explicitQuery?.where,
      orderBy: explicitQuery?.orderBy,
    };
  }

  const autoFieldSet = new Set(autoWhere.map((w) => w.field));
  const explicitWhere = explicitQuery?.where ?? [];

  const filteredExplicit: WhereParams[] = [];
  for (const clause of explicitWhere) {
    if (!autoFieldSet.has(clause.field)) {
      filteredExplicit.push(clause);
      continue;
    }
    if (clause.operator !== "==") {
      throw new Error(
        `[resolveScopedQueryOptions] auto-scoped field "${clause.field}" ` +
          `does not accept operator "${clause.operator}". ` +
          `Only "==" with the same value or omission is allowed.`,
      );
    }
    const expected = autoWhere.find((w) => w.field === clause.field)!.value;
    if (clause.value !== expected) {
      throw new Error(
        `[resolveScopedQueryOptions] auto-scoped field "${clause.field}" ` +
          `has conflicting values: identity=${JSON.stringify(expected)}, ` +
          `explicit=${JSON.stringify(clause.value)}.`,
      );
    }
  }

  return {
    where: [...autoWhere, ...filteredExplicit],
    orderBy: explicitQuery?.orderBy,
  };
};
