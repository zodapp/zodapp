import { z } from "zod";
import type { FnInput } from "@zodapp/zod-form";
import { getResolverContextSlice } from "@zodapp/zod-form/resolverContext";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";

/** 並べ替えの基準を決めるのに使う、列の情報 */
export type SortColumn = {
  propertyName: string;
  schema: z.ZodTypeAny;
  meta: {
    schemaType?: string;
    typeName?: string;
    [key: string]: unknown;
  };
};

type Row = Record<string, unknown>;

/** 値で並べる列の型（数・日付・文字・真偽・enum） */
const SORTABLE_FIELD_TYPES = new Set([
  "string",
  "number",
  "enum",
  "date",
  "boolean",
]);

const unwrap = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current.unwrap() as z.ZodTypeAny;
  }
  return current;
};

const getAt = (row: Row, segments: string[]): unknown =>
  segments.reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[key];
  }, row);

/**
 * 列を並べ替えられるか。
 * - dynamic は並べ替えない（行ごとに意味が変わるため）
 * - computed は計算した値で並べる
 * - ほかは値の型で決める（数・日付・文字・真偽・enum）
 */
export const isSortableColumn = (column: SortColumn): boolean => {
  if (column.meta.typeName === "dynamic") return false;
  if (column.meta.typeName === "computed") return true;
  return (
    typeof column.meta.schemaType === "string" &&
    SORTABLE_FIELD_TYPES.has(column.meta.schemaType)
  );
};

/** React の要素（$$typeof を持つ）か */
const isReactElement = (value: object): boolean => "$$typeof" in value;

/**
 * 値で比べられる計算結果だけを使う（それ以外は最後に並べる）。
 * オブジェクト（link・badge など）は、画面に出る文字（label）で比べる
 */
const toComparable = (value: unknown): unknown => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    !isReactElement(value) &&
    "label" in value &&
    typeof value.label === "string"
  ) {
    return value.label;
  }
  return null;
};

/**
 * 行の、並べ替えに使う値。null や undefined は最後に並べる。
 * - enum：選択肢を定義した順（何番目か）。選択肢に無い値は最後
 * - computed：計算した値。link・badge などのオブジェクトは表示名（label）
 * - ほか：値そのもの
 */
export const sortValueOf = (
  column: SortColumn,
  row: Row,
  resolverContext: RegisteredResolverContext | undefined,
): unknown => {
  const segments = column.propertyName.split(".");
  const value = getAt(row, segments);

  if (column.meta.typeName === "computed") {
    const compute = column.meta.compute as
      | ((input: FnInput) => unknown)
      | undefined;
    if (!compute) return null;
    const input: FnInput = {
      value,
      parent:
        column.meta.dependsOnParent === true
          ? getAt(row, segments.slice(0, -1))
          : undefined,
      context: getResolverContextSlice(
        resolverContext ?? {},
        column.meta.contextId as string | undefined,
      ),
    } as FnInput;
    return toComparable(compute(input));
  }

  const inner = unwrap(column.schema);
  if (inner instanceof z.ZodEnum) {
    const index = (inner.options as unknown[]).indexOf(value);
    return index === -1 ? null : index;
  }
  return value;
};
