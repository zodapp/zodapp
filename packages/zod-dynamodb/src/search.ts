import type { z } from "zod";
import { DefinitionError } from "./errors";
import type { QuerySelect } from "./query";
import type { AnyTableConfig, ItemOf, KeyFieldsOf } from "./table";
import type { Bivariant, IndexedVariant, ProjectedOf } from "./types";
import type { VectorRuntimeConfig } from "./vector";

export type VectorNames<TT extends AnyTableConfig> = keyof TT["vectors"] &
  string;

export type VectorPartition<
  TT extends AnyTableConfig,
  V extends VectorNames<TT>,
> = TT["vectors"][V]["partition"][number] & string;

type VectorField<
  TT extends AnyTableConfig,
  V extends VectorNames<TT>,
> = TT["vectors"][V]["field"] & string;

type VectorVariant<
  TT extends AnyTableConfig,
  V extends VectorNames<TT>,
> = IndexedVariant<ItemOf<TT>, VectorPartition<TT, V> | VectorField<TT, V>>;

/** 名前付きの検索の結果の1件 */
export type SearchResultOf<
  TT extends AnyTableConfig,
  V extends VectorNames<TT>,
  TSelect extends QuerySelect,
> = {
  item: TSelect extends "projection"
    ? ProjectedOf<
        VectorVariant<TT, V>,
        KeyFieldsOf<TT> | VectorPartition<TT, V>
      >
    : VectorVariant<TT, V>;
  score: number;
};

/** 検索の条件。`filters` の値は `buildFilters` で組み立てた文字列か、フィールドの値の組 */
export type SearchFilters = Record<
  string,
  string | Record<string, unknown> | undefined
>;

export type SearchContext<TContext> = TContext & {
  vectorConfig: VectorRuntimeConfig | undefined;
};

export type SearchDef<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown,
  TContext = any,
  TVector extends string = string,
> = {
  readonly kind: "search";
  readonly table: TT;
  readonly name: string;
  readonly vector: TVector;
  readonly params: TParams;
  /** `partition` と `filters` は `o.search` で、`queryVector` はサーバーの上書き（`override()`）で付ける */
  readonly partition:
    | Bivariant<
        (params: z.output<TParams>, ctx: TContext) => Record<string, unknown>
      >
    | undefined;
  readonly filters:
    | Bivariant<
        (
          params: z.output<TParams>,
          ctx: SearchContext<TContext>,
        ) => SearchFilters
      >
    | undefined;
  readonly queryVector:
    | Bivariant<
        (
          params: z.output<TParams>,
          ctx: SearchContext<TContext>,
        ) => readonly number[] | Promise<readonly number[]>
      >
    | undefined;
  readonly topK: number;
  readonly select: QuerySelect;
  readonly $result: TResult;
};

/** 1回の検索で返せる件数の上限 */
export const MAX_TOP_K = 100;

/** 名前付きの検索の定義を作る（`createOps` の `o.search` が使う） */
export const buildSearch = (
  table: AnyTableConfig,
  def: {
    vector: string;
    params: z.ZodType;
    topK: number;
    select?: QuerySelect;
  },
): SearchDef => {
  if (!table._compiled.vectors.has(def.vector)) {
    throw new DefinitionError(`unknown vector "${def.vector}"`);
  }
  if (!Number.isInteger(def.topK) || def.topK < 1 || def.topK > MAX_TOP_K) {
    throw new DefinitionError(
      `topK must be an integer between 1 and ${MAX_TOP_K}`,
    );
  }
  return {
    kind: "search",
    table,
    name: "",
    vector: def.vector,
    params: def.params,
    partition: undefined,
    filters: undefined,
    queryVector: undefined,
    topK: def.topK,
    select: def.select ?? "full",
    $result: undefined as never,
  };
};
