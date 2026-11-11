import type { z } from "zod";
import {
  SEPARATOR,
  SEPARATOR_NEXT,
  compareKeyStrings,
  typeRangeOf,
  encodeStringPrefix,
} from "./encoding";
import { DefinitionError, ValidationError } from "./errors";
import { composeKey, MAX_SORT_KEY_BYTES, type KeyPart } from "./keys";
import type {
  AnyTableConfig,
  CompiledTable,
  ItemOf,
  KeyFieldsOf,
} from "./table";
import type {
  FieldType,
  IndexedVariant,
  ProjectedOf,
  Simplify,
  Bivariant,
} from "./types";

// ---- 条件の型 ----

type RangeCondition<V> =
  | { gt: V }
  | { gte: V }
  | { lt: V }
  | { lte: V }
  | { between: readonly [V, V] }
  | ([V] extends [string] ? { beginsWith: string } : never);

type NoKeys<F extends readonly string[]> = { [K in F[number]]?: never };

/**
 * Sort Keyの条件：先頭から順に k 個を等値で指定し、続く1個に範囲条件を付けられる（§6.3）。
 * 先頭を飛ばした指定はコンパイルエラーになる。
 */
export type SortCondition<T, F extends readonly string[]> = F extends readonly [
  infer H extends string,
  ...infer R extends readonly string[],
]
  ? | NoKeys<F>
    | ({
        [K in H]: RangeCondition<Exclude<FieldType<T, H>, undefined>>;
      } & NoKeys<R>)
    | ({ [K in H]: Exclude<FieldType<T, H>, undefined> } & SortCondition<T, R>)
  : {};

export type PartitionCondition<T, F extends readonly string[]> = {
  [K in F[number]]: Exclude<FieldType<T, K>, undefined>;
};

export type QueryWhere<
  T,
  P extends readonly string[],
  S extends readonly string[],
> = {
  partition: Simplify<PartitionCondition<T, P>>;
  sort?: SortCondition<T, S>;
};

// ---- Indexの情報を型で取り出す ----

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

type SlotProjectionOf<TT extends AnyTableConfig, I> =
  I extends IndexNames<TT>
    ? TT["table"]["indexes"][TT["indexes"][I]["slot"]]["projection"]
    : "ALL";

/** 名前付きクエリの結果の1件の型 */
export type QueryResultOf<
  TT extends AnyTableConfig,
  I,
  TSelect extends QuerySelect,
> = TSelect extends "projection"
  ? SlotProjectionOf<TT, I> extends "ALL"
    ? IndexedVariant<ItemOf<TT>, IndexFields<TT, I> & string>
    : ProjectedOf<
        IndexedVariant<ItemOf<TT>, IndexFields<TT, I> & string>,
        | KeyFieldsOf<TT>
        | IndexFields<TT, I>
        | (SlotProjectionOf<TT, I> extends { include: readonly (infer A)[] }
            ? A
            : never)
      >
  : IndexedVariant<ItemOf<TT>, IndexFields<TT, I> & string>;

export type QuerySelect = "full" | "projection";

export type QueryDef<
  TT extends AnyTableConfig = AnyTableConfig,
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown,
  TContext = any,
  TIndexFields extends string = string,
> = {
  readonly kind: "query";
  readonly table: TT;
  readonly name: string;
  /** Indexの名前。省略するとベーステーブルのキーで検索する */
  readonly index: string | undefined;
  readonly params: TParams;
  readonly direction: "asc" | "desc";
  readonly select: QuerySelect;
  readonly limit: number | undefined;
  /** 条件を物理キーの条件に変換する（内部用） */
  readonly condition: Bivariant<
    (params: z.output<TParams>, ctx: TContext) => KeyCondition
  >;
  /** JS上での所属判定（§6.3） */
  readonly matches: Bivariant<
    (
      doc: Record<string, unknown>,
      params: z.output<TParams>,
      ctx: TContext,
    ) => boolean
  >;
  /** 型だけの情報 */
  readonly $result: TResult;
  /** 型だけの情報：Index（ベーステーブルならそのキー）のキーのフィールド */
  readonly $indexFields: TIndexFields;
};

// ---- 物理キーの条件 ----

/** Sort Keyの条件。境界はいずれも物理キーの文字列 */
export type SortKeyCondition =
  | { op: "eq"; value: string }
  | { op: "beginsWith"; value: string }
  | { op: "between"; low: string; high: string }
  | { op: "lt"; value: string };

export type KeyCondition = {
  readonly indexName: string | undefined;
  readonly slot: string | undefined;
  readonly pk: string;
  readonly sk: SortKeyCondition | undefined;
  /**
   * Sort Keyの等値の部分（`<entity>#<s1>#…#<sk>`、等値の部分がなければ `<entity>`）。
   * リアルタイムのトピックを求めるのに使う（§9.3）
   */
  readonly eq: string;
};

const RANGE_OPS = ["gt", "gte", "lt", "lte", "between", "beginsWith"] as const;
type RangeOp = (typeof RANGE_OPS)[number];

const MAX_CODE_POINT = String.fromCodePoint(0x10ffff);

/**
 * 物理キーの文字列 `s` より小さい最大の文字列の代わりになる、`s` 未満のすべてのキーを含む上限。
 * Sort Keyの長さの上限まで最大の文字を詰める。
 */
const predecessor = (s: string): string => {
  const chars = [...s];
  const last = chars.pop()!;
  let code = last.codePointAt(0)! - 1;
  if (code >= 0xd800 && code <= 0xdfff) code = 0xd7ff;
  const head = chars.join("") + String.fromCodePoint(code);
  const headBytes = new TextEncoder().encode(head).length;
  const fill = Math.max(0, Math.floor((MAX_SORT_KEY_BYTES - headBytes) / 4));
  return head + MAX_CODE_POINT.repeat(fill);
};

const encodeField = (part: KeyPart, index: number, value: unknown) => {
  if (value === undefined) {
    throw new ValidationError(
      `query condition for "${part.fields[index]}" must not be undefined`,
    );
  }
  return part.encoders[index]!.encode(value);
};

/**
 * 宣言的な条件を、物理キーの条件に変換する。等値の部分を接頭辞に、範囲条件を `BETWEEN` などにする。
 * どちらも §5.6 の順序保存の条件があるから成り立つ。
 */
export const compileKeyCondition = (
  entity: string,
  partition: KeyPart,
  sort: KeyPart,
  where: { partition: Record<string, unknown>; sort?: Record<string, unknown> },
): { pk: string; sk: SortKeyCondition | undefined; eq: string } => {
  for (const f of Object.keys(where.partition)) {
    if (!partition.fields.includes(f)) {
      throw new ValidationError(
        `"${f}" is not a partition field of this index`,
      );
    }
  }
  const pk = composeKey(entity, partition, where.partition);
  if (pk === undefined) {
    throw new ValidationError("all partition fields must be specified");
  }
  const sortWhere = where.sort ?? {};
  for (const f of Object.keys(sortWhere)) {
    if (!sort.fields.includes(f)) {
      throw new ValidationError(`"${f}" is not a sort field of this index`);
    }
  }
  if (sort.fields.length === 0) {
    return { pk, sk: { op: "eq", value: entity }, eq: entity };
  }
  let prefix = entity + SEPARATOR;
  /** ここまでの等値の部分（末尾の区切り文字を除く） */
  const eqPart = () => prefix.slice(0, -1);
  for (let i = 0; i < sort.fields.length; i++) {
    const field = sort.fields[i]!;
    if (!(field in sortWhere)) {
      // ここから先は指定がない（先頭を飛ばした指定は後続の検査で拒否する）
      for (const rest of sort.fields.slice(i + 1)) {
        if (rest in sortWhere) {
          throw new ValidationError(
            `sort condition on "${rest}" requires "${field}" to be specified`,
          );
        }
      }
      return { pk, sk: { op: "beginsWith", value: prefix }, eq: eqPart() };
    }
    const cond = sortWhere[field];
    const range =
      cond !== null &&
      typeof cond === "object" &&
      !(cond instanceof Date) &&
      Object.keys(cond).length === 1 &&
      RANGE_OPS.includes(Object.keys(cond)[0] as RangeOp)
        ? (cond as Record<RangeOp, unknown>)
        : undefined;
    if (!range) {
      const encoded = encodeField(sort, i, cond);
      if (i === sort.fields.length - 1) {
        return {
          pk,
          sk: { op: "eq", value: prefix + encoded },
          eq: prefix + encoded,
        };
      }
      prefix += encoded + SEPARATOR;
      continue;
    }
    for (const rest of sort.fields.slice(i + 1)) {
      if (rest in sortWhere) {
        throw new ValidationError(
          `no condition is allowed on "${rest}" after the range condition on "${field}"`,
        );
      }
    }
    // prefix の範囲の上限（prefix の末尾の区切り文字を、その次の文字に置き換えたもの）
    const end = prefix.slice(0, -1) + SEPARATOR_NEXT;
    const [op] = Object.keys(range) as [RangeOp];
    const enc = (v: unknown) => encodeField(sort, i, v);
    // 範囲は境界の値と同じ型の値に限る（型ごとに識別子が異なり、型をまたぐと順序に意味がないため）
    const typed = (v: unknown) => {
      const encoded = enc(v);
      const t = typeRangeOf(encoded);
      return {
        value: prefix + encoded,
        low: prefix + t.low,
        high: t.high === undefined ? end : prefix + t.high,
      };
    };
    const between = (low: string, high: string): SortKeyCondition =>
      compareKeyStrings(low, high) > 0
        ? // 一致するItemがない。区切り文字の次の文字だけで終わるキーは存在しない
          { op: "eq", value: prefix + SEPARATOR_NEXT }
        : { op: "between", low, high };
    switch (op) {
      case "gte": {
        const b = typed(range.gte);
        return { pk, sk: between(b.value, b.high), eq: eqPart() };
      }
      case "gt": {
        const b = typed(range.gt);
        return {
          pk,
          sk: between(b.value + SEPARATOR_NEXT, b.high),
          eq: eqPart(),
        };
      }
      case "lte": {
        const b = typed(range.lte);
        return {
          pk,
          sk: between(b.low, b.value + SEPARATOR_NEXT),
          eq: eqPart(),
        };
      }
      case "lt": {
        const b = typed(range.lt);
        return { pk, sk: between(b.low, predecessor(b.value)), eq: eqPart() };
      }
      case "between": {
        const [lowValue, highValue] = range.between as [unknown, unknown];
        const low = typed(lowValue);
        const high = typed(highValue);
        if (low.low !== high.low) {
          throw new ValidationError(
            "both bounds of between must have the same type",
          );
        }
        return {
          pk,
          sk: between(low.value, high.value + SEPARATOR_NEXT),
          eq: eqPart(),
        };
      }
      case "beginsWith": {
        if (!sort.encoders[i]!.isString) {
          throw new ValidationError(
            `beginsWith can only be used on string fields`,
          );
        }
        return {
          pk,
          sk: {
            op: "beginsWith",
            value: prefix + encodeStringPrefix(range.beginsWith as string),
          },
          eq: eqPart(),
        };
      }
    }
  }
  return { pk, sk: { op: "beginsWith", value: prefix }, eq: eqPart() };
};

/** 物理キーの条件を、JS上で物理キーの値に対して評価する */
export const evaluateSortCondition = (
  sk: string,
  cond: SortKeyCondition | undefined,
): boolean => {
  if (!cond) return true;
  switch (cond.op) {
    case "eq":
      return sk === cond.value;
    case "beginsWith":
      return sk.startsWith(cond.value);
    case "lt":
      return compareKeyStrings(sk, cond.value) < 0;
    case "between":
      return (
        compareKeyStrings(sk, cond.low) >= 0 &&
        compareKeyStrings(sk, cond.high) <= 0
      );
  }
};

const indexParts = (compiled: CompiledTable, index: string | undefined) => {
  if (index === undefined) {
    return {
      partition: compiled.key.partition,
      sort: compiled.key.sort,
      slot: undefined,
    };
  }
  const idx = compiled.indexes.get(index);
  if (!idx) {
    throw new DefinitionError(
      `entity "${compiled.entity}": unknown index "${index}"`,
    );
  }
  return { partition: idx.partition, sort: idx.sort, slot: idx.slot };
};

/** クエリの定義の素材（`createOps` の `o.query` が使う） */
export type RawQuerySpec = {
  index?: string;
  params: z.ZodType;
  where: (
    p: unknown,
    ctx: unknown,
  ) => {
    partition: Record<string, unknown>;
    sort?: Record<string, unknown>;
  };
  direction?: "asc" | "desc";
  select?: QuerySelect;
  limit?: number;
};

/** クエリの定義を 1 つ組み立てる（内部用）。名前は後で付ける */
export const buildQuery = (table: AnyTableConfig, def: RawQuerySpec) => {
  const compiled = table._compiled;
  const parts = indexParts(compiled, def.index);
  const condition = (params: unknown, ctx: unknown): KeyCondition => {
    const { pk, sk, eq } = compileKeyCondition(
      compiled.entity,
      parts.partition,
      parts.sort,
      def.where(params, ctx),
    );
    return { indexName: def.index, slot: parts.slot, pk, sk, eq };
  };
  const query = {
    kind: "query",
    table,
    name: "",
    index: def.index,
    params: def.params,
    direction: def.direction ?? "asc",
    select: def.select ?? "full",
    limit: def.limit,
    condition,
    matches: (doc: Record<string, unknown>, params: unknown, ctx: unknown) => {
      const cond = condition(params, ctx);
      const pk = composeKey(compiled.entity, parts.partition, doc);
      const sk = composeKey(compiled.entity, parts.sort, doc);
      if (pk === undefined || sk === undefined) return false;
      return pk === cond.pk && evaluateSortCondition(sk, cond.sk);
    },
    $result: undefined as never,
    $indexFields: undefined as never,
  } satisfies QueryDef;
  return query;
};
