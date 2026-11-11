import type { JsonTransport } from "@zodapp/zod-transport-json";
import { jsonTransport } from "./json-transport";
import type { z } from "zod";
import type { FieldsInput } from "./endpoint";
import { queryItemSchema, selectedFields } from "./item-schema";
import type { QueryDef } from "./query";
import type { AnyTableConfig, KeyFieldsOf, TableKey } from "./table";

type Picked<T, K> = T extends unknown
  ? { [P in keyof T as P extends K ? P : never]: T[P] }
  : never;
type Omitted<T, K> = T extends unknown
  ? { [P in keyof T as P extends K ? never : P]: T[P] }
  : never;

/** `fields` で絞った Item の型。キーと Index のキーのフィールドは常に残る（実行時は判別子も残る） */
export type SubscriptionItemOf<Q extends QueryDef, F> = F extends {
  pick: readonly (infer P)[];
}
  ? Picked<Q["$result"], P | KeyFieldsOf<Q["table"]> | Q["$indexFields"]>
  : F extends { omit: readonly (infer O)[] }
    ? Omitted<
        Q["$result"],
        Exclude<O, KeyFieldsOf<Q["table"]> | Q["$indexFields"]>
      >
    : Q["$result"];

/**
 * Subscription のコントラクト（§9.2）。名前付きクエリと、ページと変更に含めるフィールドの組。
 * ブラウザでも使える。Item の値は §7.4 の transport で JSON と変換する。
 */
export type SubscriptionDef<Q extends QueryDef = QueryDef, TItem = unknown> = {
  readonly kind: "subscription";
  readonly query: Q;
  readonly table: AnyTableConfig;
  /** クエリの名前 */
  readonly name: string;
  /** ページと変更に含めるフィールド。`undefined` ならすべて */
  readonly fields: ReadonlySet<string> | undefined;
  /** ページと変更の Item の Schema */
  readonly itemSchema: z.ZodType;
  encodeParams(params: z.input<Q["params"]>): unknown;
  decodeParams(json: unknown): z.output<Q["params"]>;
  encodeItem(item: TItem): unknown;
  decodeItem(json: unknown): TItem;
  encodeKey(key: TableKey<Q["table"]>): unknown;
  decodeKey(json: unknown): TableKey<Q["table"]>;
  /** 型だけの情報 */
  readonly $item: TItem;
  readonly $params: z.input<Q["params"]>;
};

export type AnySubscriptionDef = SubscriptionDef<
  QueryDef<any, any, any, any>,
  any
>;

/** クエリの Index（ベーステーブルならそのキー）の Partition Key と Sort Key のフィールド */
export const indexKeyFields = (query: QueryDef): string[] => {
  const compiled = query.table._compiled;
  const parts =
    query.index === undefined
      ? compiled.key
      : compiled.indexes.get(query.index)!;
  return [...parts.partition.fields, ...parts.sort.fields];
};

/**
 * Subscription を定義する（§9.2）。`fields` を指定すると、ページと変更の Item をそのフィールドに絞る。
 */
export const subscription = <
  Q extends QueryDef,
  const F extends FieldsInput<Q["table"]> | undefined = undefined,
>(
  query: Q,
  options: { fields?: F } = {},
): SubscriptionDef<Q, SubscriptionItemOf<Q, F>> => {
  const selected = selectedFields(query.table, options.fields);
  // Client が並べ替えとウィンドウの判定に使うので、クエリの Index のキーのフィールドは常に含める
  const fields = selected && new Set([...selected, ...indexKeyFields(query)]);
  const itemSchema = queryItemSchema(query, fields);
  const params = jsonTransport(query.params);
  const item: JsonTransport<z.ZodType> = jsonTransport(itemSchema);
  const key = jsonTransport(query.table._compiled.keySchema);
  return {
    kind: "subscription",
    query,
    table: query.table,
    get name() {
      return query.name;
    },
    fields,
    itemSchema,
    encodeParams: (p) => params.encode(p),
    decodeParams: (json) => params.decode(json) as never,
    encodeItem: (i) => item.encode(i),
    decodeItem: (json) => item.decode(json) as never,
    encodeKey: (k) => key.encode(k),
    decodeKey: (json) => key.decode(json) as never,
    $item: undefined as never,
    $params: undefined as never,
  };
};
