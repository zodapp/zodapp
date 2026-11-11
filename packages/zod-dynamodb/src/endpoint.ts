import type { JsonTransport } from "@zodapp/zod-transport-json";
import { jsonTransport } from "./json-transport";
import { z } from "zod";
import { DefinitionError } from "./errors";
import type { MutationDef } from "./mutation";
import {
  fieldsSchema,
  queryItemSchema,
  searchItemSchema,
  selectedFields,
  type Selection,
} from "./item-schema";
import type { QueryDef } from "./query";
import type { SearchDef } from "./search";
import type { AnyTableConfig, ItemOf, TableKey } from "./table";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type EndpointKind =
  | "get"
  | "create"
  | "createWithGeneratedKey"
  | "set"
  | "delete"
  | "mutation"
  | "query"
  | "search";

/** 返すフィールドの指定（§7.3）。キーのフィールドは常に返す */
export type FieldsInput<TT extends AnyTableConfig> =
  | { pick: readonly (keyof ItemOf<TT> & string)[] }
  | { omit: readonly (keyof ItemOf<TT> & string)[] };

/**
 * エンドポイントのコントラクト（§7.2）。操作の定義と、パス・HTTPメソッドの組。
 * 入力と出力のSchemaと、JSONとの変換（§7.4）を持つ。ブラウザでも使える。
 */
export type Endpoint<
  TKind extends EndpointKind = EndpointKind,
  TDef = unknown,
  TInput = any,
  TOutput = any,
> = {
  readonly kind: TKind;
  /** 操作の定義（Table定義、名前付きのクエリ・ミューテーション・検索） */
  readonly def: TDef;
  readonly table: AnyTableConfig;
  /** 認可で使う名前。名前付きの操作はその名前、それ以外はエンティティ名 */
  readonly name: string;
  readonly path: string;
  readonly method: HttpMethod;
  /** Getで `ifUnchanged` に渡すトークンも返すか */
  readonly withToken: boolean;
  /** 入力のSchema（値の形） */
  readonly inputSchema: z.ZodType;
  /** 出力のSchema。`fields` を指定できる操作では入力によって変わる */
  outputSchema(input?: TInput): z.ZodType;
  /** 入力をJSONに変換する（Client）。Schemaで検証する */
  encodeInput(input: TInput): unknown;
  /** JSONから入力に戻す（サーバー）。Schemaで検証する */
  decodeInput(json: unknown): TInput;
  /** 出力をJSONに変換する（サーバー）。Schemaで検証する */
  encodeOutput(output: TOutput, input: TInput): unknown;
  /** JSONから出力に戻す（Client） */
  decodeOutput(json: unknown, input: TInput): TOutput;
  /** 型だけの情報 */
  readonly $input: TInput;
  readonly $output: TOutput;
};

export type EndpointOptions = {
  path: string;
  /** 既定は `POST`（入力をbodyに入れる） */
  method?: HttpMethod;
};

export type InputOf<E extends Endpoint> = E["$input"];
export type OutputOf<E extends Endpoint> = E["$output"];

// ---- 入出力の型 ----

export type GetOutput<TT extends AnyTableConfig> = {
  item: ItemOf<TT> | null;
  token?: string;
};

export type CreateInput<TT extends AnyTableConfig> = {
  key: TableKey<TT>;
  input: z.input<TT["create"]>;
};

export type CreateWithGeneratedKeyInput<
  TT extends AnyTableConfig,
  TArgs extends z.ZodType,
> = {
  args: z.input<TArgs>;
  input: z.input<TT["create"]>;
};

export type SetInput<TT extends AnyTableConfig> = {
  key: TableKey<TT>;
  input: z.input<TT["item"]>;
};

export type ItemOutput<TT extends AnyTableConfig> = { item: ItemOf<TT> };

export type MutationInput<M extends MutationDef> = {
  key: TableKey<M["table"]>;
  params: z.input<M["params"]>;
  ifUnchanged?: string;
};

export type QueryInput<Q extends QueryDef> = {
  params: z.input<Q["params"]>;
  cursor?: string;
  limit?: number;
  fields?: FieldsInput<Q["table"]>;
};

export type QueryOutput<Q extends QueryDef> = {
  items: Q["$result"][];
  cursor?: string;
};

export type SearchInput<S extends SearchDef> = {
  params: z.input<S["params"]>;
  fields?: FieldsInput<S["table"]>;
};

export type SearchOutput<S extends SearchDef> = {
  results: S["$result"][];
};

// ---- 組み立て ----

/** 指定したフィールドだけを残す（Item1件） */
export const pickFields = (
  item: Record<string, unknown>,
  fields: ReadonlySet<string>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) if (fields.has(k)) out[k] = v;
  return out;
};

/** `fields` の指定から、返すフィールドの集合を求める（サーバーで結果を絞るときに使う） */
export const fieldsOf = (
  endpoint: Endpoint,
  input: { fields?: Selection } | undefined,
): ReadonlySet<string> | undefined =>
  selectedFields(endpoint.table, input?.fields);

const memo = <T>(build: (key: string, sel: Selection | undefined) => T) => {
  const cache = new Map<string, T>();
  return (sel: Selection | undefined): T => {
    const key = sel ? JSON.stringify(sel) : "";
    let value = cache.get(key);
    if (value === undefined) {
      value = build(key, sel);
      cache.set(key, value);
    }
    return value;
  };
};

const make = <TKind extends EndpointKind, TDef, TInput, TOutput>(spec: {
  kind: TKind;
  def: TDef;
  table: AnyTableConfig;
  name: string;
  options: EndpointOptions;
  withToken?: boolean;
  input: z.ZodType;
  /** `fields` の指定から出力のSchemaを作る */
  output: (fields: ReadonlySet<string> | undefined) => z.ZodType;
  /** 入力から `fields` の指定を取り出す。指定できない操作では省略 */
  selection?: (input: TInput | undefined) => Selection | undefined;
}): Endpoint<TKind, TDef, TInput, TOutput> => {
  const inputTransport = jsonTransport(spec.input);
  const output = memo<{
    schema: z.ZodType;
    transport: JsonTransport<z.ZodType>;
  }>((_key, sel) => {
    const schema = spec.output(selectedFields(spec.table, sel));
    return { schema, transport: jsonTransport(schema) };
  });
  const selectionOf = (input: TInput | undefined) =>
    spec.selection?.(input) ?? undefined;
  return {
    kind: spec.kind,
    def: spec.def,
    table: spec.table,
    name: spec.name,
    path: spec.options.path,
    method: spec.options.method ?? "POST",
    withToken: spec.withToken ?? false,
    inputSchema: spec.input,
    outputSchema: (input) => output(selectionOf(input)).schema,
    encodeInput: (input) => inputTransport.encode(input),
    decodeInput: (json) => inputTransport.decode(json) as TInput,
    encodeOutput: (out, input) =>
      output(selectionOf(input)).transport.encode(out),
    decodeOutput: (json, input) =>
      output(selectionOf(input)).transport.decode(json) as TOutput,
    $input: undefined as never,
    $output: undefined as never,
  };
};

const key = (table: AnyTableConfig) => table._compiled.keySchema;

/** エンドポイントのコントラクトを作る（§7.2） */
export const endpoint = {
  /** Item1件の取得。入力はキー。`withToken` を指定すると `ifUnchanged` のトークンも返す */
  get: <TT extends AnyTableConfig>(
    table: TT,
    options: EndpointOptions & { withToken?: boolean },
  ) =>
    make<"get", TT, TableKey<TT>, GetOutput<TT>>({
      kind: "get",
      def: table,
      table,
      name: table.entity,
      options,
      withToken: options.withToken,
      input: key(table),
      output: () =>
        z.object({
          item: table.item.nullable(),
          token: z.string().optional(),
        }),
    }),

  create: <TT extends AnyTableConfig>(table: TT, options: EndpointOptions) =>
    make<"create", TT, CreateInput<TT>, ItemOutput<TT>>({
      kind: "create",
      def: table,
      table,
      name: table.entity,
      options,
      input: z.object({ key: key(table), input: table.create }),
      output: () => z.object({ item: table.item }),
    }),

  /**
   * キーを生成して作成する（§6.2）。キーの生成は tableConfig の `generateKey` にあり、
   * 生成に使う値のSchemaはここで渡す。
   */
  createWithGeneratedKey: <TT extends AnyTableConfig, TArgs extends z.ZodType>(
    table: TT,
    options: EndpointOptions & { args: TArgs },
  ) =>
    make<
      "createWithGeneratedKey",
      TT,
      CreateWithGeneratedKeyInput<TT, TArgs>,
      ItemOutput<TT>
    >({
      kind: "createWithGeneratedKey",
      def: table,
      table,
      name: table.entity,
      options,
      input: z.object({ args: options.args, input: table.create }),
      output: () => z.object({ item: table.item }),
    }),

  /** Item全体の置き換え（§6.4）。公開するかはアプリケーションが決める */
  set: <TT extends AnyTableConfig>(table: TT, options: EndpointOptions) =>
    make<"set", TT, SetInput<TT>, ItemOutput<TT>>({
      kind: "set",
      def: table,
      table,
      name: table.entity,
      options,
      input: z.object({ key: key(table), input: table.item }),
      output: () => z.object({ item: table.item }),
    }),

  delete: <TT extends AnyTableConfig>(table: TT, options: EndpointOptions) =>
    make<"delete", TT, { key: TableKey<TT> }, Record<string, never>>({
      kind: "delete",
      def: table,
      table,
      name: table.entity,
      options,
      input: z.object({ key: key(table) }),
      output: () => z.object({}),
    }),

  mutation: <M extends MutationDef>(mutation: M, options: EndpointOptions) =>
    make<"mutation", M, MutationInput<M>, ItemOutput<M["table"]>>({
      kind: "mutation",
      def: mutation,
      table: mutation.table,
      name: mutation.name,
      options,
      input: z.object({
        key: key(mutation.table),
        params: mutation.params,
        ifUnchanged: z.string().optional(),
      }),
      output: () => z.object({ item: mutation.table.item }),
    }),

  query: <Q extends QueryDef>(query: Q, options: EndpointOptions) =>
    make<"query", Q, QueryInput<Q>, QueryOutput<Q>>({
      kind: "query",
      def: query,
      table: query.table,
      name: query.name,
      options,
      input: z.object({
        params: query.params,
        cursor: z.string().optional(),
        limit: z.int().positive().optional(),
        fields: fieldsSchema(query.table).optional(),
      }),
      output: (fields) =>
        z.object({
          items: z.array(queryItemSchema(query, fields)),
          cursor: z.string().optional(),
        }),
      selection: (input) => input?.fields as Selection | undefined,
    }),

  search: <S extends SearchDef>(search: S, options: EndpointOptions) =>
    make<"search", S, SearchInput<S>, SearchOutput<S>>({
      kind: "search",
      def: search,
      table: search.table,
      name: search.name,
      options,
      input: z.object({
        params: search.params,
        fields: fieldsSchema(search.table).optional(),
      }),
      output: (fields) =>
        z.object({
          results: z.array(
            z.object({
              item: searchItemSchema(search, fields),
              score: z.number(),
            }),
          ),
        }),
      selection: (input) => input?.fields as Selection | undefined,
    }),
};

/**
 * パスのパラメーター（`/tasks/:workspaceId/:taskId`）を入力の同名のフィールドで埋める（§7.2）。
 * 入力の直下、`key`、`params` の順に探す。値はJSONに変換した後のもの。
 */
export const buildPath = (path: string, json: unknown): string =>
  path.replace(/:([A-Za-z_$][\w$]*)/g, (_m, name: string) => {
    const root = (json ?? {}) as Record<string, unknown>;
    const scopes = [
      root,
      root.key as Record<string, unknown> | undefined,
      root.params as Record<string, unknown> | undefined,
    ];
    for (const scope of scopes) {
      const value = scope?.[name];
      if (value !== undefined && value !== null && typeof value !== "object") {
        return encodeURIComponent(String(value));
      }
    }
    throw new DefinitionError(`path parameter "${name}" is not in the input`);
  });
