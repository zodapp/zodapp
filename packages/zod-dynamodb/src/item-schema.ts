/**
 * 出力のItemのSchemaを作る内部の補助（エンドポイントと Subscription で共有する。§7.3）
 */
import { z } from "zod";
import { discriminatorsOf, narrowItemSchema } from "./narrow";
import type { QueryDef } from "./query";
import type { SearchDef } from "./search";
import type { AnyTableConfig } from "./table";

export type Selection = { pick?: readonly string[]; omit?: readonly string[] };

export const fieldsSchema = (table: AnyTableConfig) => {
  const names = [...table._compiled.fieldNames] as [string, ...string[]];
  const field = z.enum(names);
  return z.union([
    z.strictObject({ pick: z.array(field) }),
    z.strictObject({ omit: z.array(field) }),
  ]);
};

/** `fields` の指定から、返すフィールドの集合を求める。キーと判別子のフィールドは常に含める */
export const selectedFields = (
  table: AnyTableConfig,
  selection: Selection | undefined,
): ReadonlySet<string> | undefined => {
  if (!selection) return undefined;
  const fields = new Set<string>([
    ...table._compiled.keyFields,
    ...discriminatorsOf(table.item),
  ]);
  if (selection.pick) {
    for (const f of selection.pick) fields.add(f);
  } else {
    const omit = new Set(selection.omit);
    for (const f of table._compiled.fieldNames) if (!omit.has(f)) fields.add(f);
  }
  return fields;
};

/** itemのSchema。`fields` で絞るときは、返すフィールドだけを残す */
export const itemSchema = (
  table: AnyTableConfig,
  fields: ReadonlySet<string> | undefined,
): z.ZodType =>
  fields ? narrowItemSchema(table.item, { keep: fields }) : table.item;

/**
 * 射影（`select: "projection"`）の結果のSchema。
 * キーと、Indexのキーのフィールドだけが必ずあり、それ以外は省略できる。
 */
export const projectedSchema = (
  table: AnyTableConfig,
  required: Iterable<string>,
  fields: ReadonlySet<string> | undefined,
): z.ZodType =>
  narrowItemSchema(table.item, {
    keep: fields,
    required: new Set([...table._compiled.keyFields, ...required]),
  });

export const queryItemSchema = (
  query: QueryDef,
  fields: ReadonlySet<string> | undefined,
): z.ZodType => {
  const table = query.table;
  if (query.index === undefined || query.select === "full") {
    return itemSchema(table, fields);
  }
  const index = table._compiled.indexes.get(query.index)!;
  if (index.physical.projection === "ALL") return itemSchema(table, fields);
  return projectedSchema(table, index.fields, fields);
};

export const searchItemSchema = (
  search: SearchDef,
  fields: ReadonlySet<string> | undefined,
): z.ZodType => {
  const table = search.table;
  if (search.select === "full") return itemSchema(table, fields);
  const vector = table._compiled.vectors.get(search.vector)!;
  return projectedSchema(table, vector.partition.fields, fields);
};
