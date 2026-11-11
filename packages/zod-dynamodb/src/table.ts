import { z } from "zod";
import { encoderFor, type FieldEncoder } from "./encoding";
import { DefinitionError } from "./errors";
import type { KeyPart } from "./keys";
import type { IndexSlot, PhysicalTable, VectorSlot } from "./physical";
import {
  assertReparseable,
  primarySchema,
  variantsOf,
  type Variant,
} from "./schema";
import type { AllKeys, BaseKeyField, IndexKeyField, KeyOf } from "./types";
import type { FilterSpec, VectorRuntimeConfig } from "./vector";

type AnyPhysicalTable = PhysicalTable<
  Record<string, IndexSlot>,
  Record<string, VectorSlot>
>;

/** フックが受け取る値 */
export type HookContext<TKey> = {
  /** 書き込みの時刻。1回の書き込みの中で共通 */
  now: Date;
  key: TKey;
};

export type IndexDef<T, TSlot extends string> = {
  readonly slot: TSlot;
  readonly partition: readonly IndexKeyField<T>[];
  readonly sort?: readonly IndexKeyField<T>[];
};

/** 静的なフィルター：フィルターの属性名から、連結するフィールドの並び */
export type StaticFilters<T, TAttr extends string> = {
  readonly [A in TAttr]?: readonly IndexKeyField<T>[];
};

export type VectorContext = { vectorConfig: VectorRuntimeConfig };

/** ベクトル検索の定義のうち、コントラクトに置く静的な部分（§5.8） */
export type VectorDef<T, TSlot extends string, TFilterAttr extends string> = {
  /** embeddingベクトルを持つitemのフィールド */
  readonly field: AllKeys<T>;
  /** 使うスロット。省略すると、実行時の設定で選ぶ（実装の `vectors.*.slot` が必要） */
  readonly slot?: TSlot;
  /** `HASH` を構成するフィールド */
  readonly partition: readonly IndexKeyField<T>[];
  /** `INLINE_FILTER` の静的な対応。実行時の設定から組み立てる場合は実装の `vectors.*.filters` に書く */
  readonly filters?: StaticFilters<T, TFilterAttr>;
};

/** ベクトル検索の定義のうち、実行時の設定を使う部分（実装の側。§5.8） */
export type VectorImpl<T> = {
  /** 実行時の設定（`ctx.vectorConfig.slot`）でスロットを選ぶ */
  readonly slot?: (row: T, ctx: VectorContext) => string;
  /** 実行時の設定から `INLINE_FILTER` の値を組み立てる */
  readonly filters?: (row: T, ctx: VectorContext) => Record<string, string>;
};

type FilterAttrsOf<TTable extends AnyPhysicalTable> = {
  [
    S in keyof TTable["vectorIndexes"]
  ]: TTable["vectorIndexes"][S]["filters"][number];
}[keyof TTable["vectorIndexes"]] &
  string;

// ---- 内部表現 ----

export type CompiledIndex = {
  readonly name: string;
  readonly slot: string;
  readonly physical: IndexSlot;
  readonly partition: KeyPart;
  readonly sort: KeyPart;
  /** このIndexのキーに使うフィールド */
  readonly fields: ReadonlySet<string>;
};

export type CompiledVector = {
  readonly name: string;
  readonly field: string;
  readonly slot: string | ((row: unknown, ctx: VectorContext) => string);
  readonly partition: KeyPart;
  readonly filters:
    | {
        readonly kind: "static";
        readonly spec: Readonly<Record<string, KeyPart>>;
      }
    | {
        readonly kind: "dynamic";
        readonly build: (
          row: unknown,
          ctx: VectorContext,
        ) => Record<string, string>;
      }
    | { readonly kind: "none" };
  /** 実行時の設定が必要か */
  readonly dynamic: boolean;
};

export type CompiledTable = {
  readonly entity: string;
  readonly physical: AnyPhysicalTable;
  readonly variants: readonly Variant[];
  readonly fieldNames: ReadonlySet<string>;
  readonly key: { readonly partition: KeyPart; readonly sort: KeyPart };
  readonly keyFields: readonly string[];
  /** キーの検証Schema（内部専用） */
  readonly keySchema: z.ZodType<Record<string, unknown>>;
  readonly indexes: ReadonlyMap<string, CompiledIndex>;
  readonly vectors: ReadonlyMap<string, CompiledVector>;
  readonly immutable: ReadonlySet<string>;
  /** 各フィールドのキーのエンコード方式（キーやIndexに使うフィールドのみ） */
  readonly encoders: ReadonlyMap<string, FieldEncoder>;
};

// ---- 公開する型 ----

export type TableConfig<
  TTable extends AnyPhysicalTable = AnyPhysicalTable,
  TItem extends z.ZodType = z.ZodType,
  TCreate extends z.ZodType = z.ZodType,
  TPartition extends readonly string[] = readonly string[],
  TSort extends readonly string[] = readonly string[],
  TIndexes extends Record<string, IndexDef<any, string>> = Record<
    string,
    IndexDef<any, string>
  >,
  TVectors extends Record<string, VectorDef<any, string, string>> = Record<
    string,
    VectorDef<any, string, string>
  >,
  TCreateCheck = unknown,
  TGenerateArgs = never,
> = {
  readonly kind: "table";
  readonly table: TTable;
  readonly entity: string;
  /** 利用者が指定したSchemaをそのまま返す */
  readonly item: TItem;
  readonly create: TCreate;
  readonly key: { readonly partition: TPartition; readonly sort: TSort };
  readonly indexes: TIndexes;
  readonly vectors: TVectors;
  readonly immutable: readonly string[];
  readonly onCreate?: (ctx: HookContext<any>) => object;
  readonly onWrite?: (ctx: HookContext<any>) => object;
  /** キーを生成する（`zod-firebase` の `onCreateId` に相当）。生成に必要な値を引数として受け取る */
  generateKey?(args: TGenerateArgs, input: unknown): object;
  /** キーの生成に使う値の Schema（`createWithGeneratedKey` の入力の検証に使う） */
  readonly generateKeyArgs?: z.ZodType;
  /** 書き込みに `ifUnchanged` のトークンを必須にするか（§6.4）。既定は `"optional"` */
  readonly ifUnchanged: IfUnchangedMode;
  /**
   * 作成の入力・キー・フックの戻り値でitemを満たせるかの型での検査（§5.3）。
   * 満たせない場合はRepositoryに渡した時点でエラーになる。
   */
  readonly $createCheck: TCreateCheck;
  /** 内部表現 */
  readonly _compiled: CompiledTable;
  /** コントラクトの元の定義（実装を付けるときに、実行時の部分と合わせて組み直す） */
  readonly _raw: RawTableDef;
};

/** 編集中の他者の更新を検出するトークン（`ifUnchanged`）を必須にするか（§6.4） */
export type IfUnchangedMode = "required" | "optional";

export type AnyTableConfig = TableConfig<
  AnyPhysicalTable,
  z.ZodType,
  z.ZodType,
  readonly string[],
  readonly string[],
  Record<string, IndexDef<any, string>>,
  Record<string, VectorDef<any, string, string>>,
  unknown,
  any
>;

export type ItemOf<T extends AnyTableConfig> = z.output<T["item"]>;
export type CreateOf<T extends AnyTableConfig> = z.output<T["create"]>;
export type KeyFieldsOf<T extends AnyTableConfig> =
  T["key"]["partition"][number] | T["key"]["sort"][number];
export type TableKey<T extends AnyTableConfig> = KeyOf<
  ItemOf<T>,
  KeyFieldsOf<T> & string
>;

type CreateCheck<TItemIn, TMerged> = [TMerged] extends [TItemIn]
  ? true
  : {
      error: "create の入力・キー・onCreate / onWrite の戻り値で item を満たせません。足りない値は tableConfig() の onCreate / onWrite で返してください";
      merged: TMerged;
    };

const isValidEntity = (entity: string) =>
  entity.length > 0 && [...entity].every((ch) => ch.codePointAt(0)! > 0x24);

const keyPart = (
  fields: readonly string[],
  encoders: ReadonlyMap<string, FieldEncoder>,
): KeyPart => ({
  fields,
  encoders: fields.map((f) => encoders.get(f)!),
});

/**
 * Table定義を作る（§5.3）。
 */
export const tableConfig = <
  TTable extends AnyPhysicalTable,
  TItem extends z.ZodType,
  TCreate extends z.ZodType,
  const TPartition extends readonly BaseKeyField<z.output<TItem>>[],
  const TSort extends readonly BaseKeyField<z.output<TItem>>[] = [],
  const TIndexes extends {
    [name: string]: IndexDef<z.output<TItem>, keyof TTable["indexes"] & string>;
  } = {},
  const TVectors extends Record<string, unknown> = {},
  TOnCreate extends object = {},
  TOnWrite extends object = {},
  TGenArgs extends z.ZodType = never,
>(def: {
  table: TTable;
  /** 物理キーの接頭辞。変更するとデータ移行が必要 */
  entity: string;
  item: TItem;
  create: TCreate;
  key: { partition: TPartition; sort?: TSort };
  immutable?: readonly AllKeys<z.output<TItem>>[];
  /** 書き込みに `ifUnchanged` のトークンを必須にするか（§6.4）。既定は `"optional"` */
  ifUnchanged?: IfUnchangedMode;
  indexes?: TIndexes;
  vectors?: {
    [K in keyof TVectors]: TVectors[K] &
      VectorDef<
        z.output<TItem>,
        keyof TTable["vectorIndexes"] & string,
        FilterAttrsOf<TTable>
      >;
  };
  /** 作成のときに足す値（`createdAt` など）。サーバーで書き込みのたびに呼ぶ */
  onCreate?: (
    ctx: HookContext<
      KeyOf<z.output<TItem>, TPartition[number] | TSort[number]>
    >,
  ) => TOnCreate;
  /** 書き込み（作成と更新）のたびに足す値（`updatedAt` など） */
  onWrite?: (
    ctx: HookContext<
      KeyOf<z.output<TItem>, TPartition[number] | TSort[number]>
    >,
  ) => TOnWrite;
  /** キーを生成する（§6.2）。`args` は生成に使う値（Partition Key など）の Schema */
  generateKey?: {
    args: TGenArgs;
    key: (
      args: z.output<TGenArgs>,
      input: z.output<TCreate>,
    ) => KeyOf<z.output<TItem>, TPartition[number] | TSort[number]>;
  };
}): TableConfig<
  TTable,
  TItem,
  TCreate,
  TPartition,
  TSort,
  TIndexes,
  {
    [K in keyof TVectors]: TVectors[K] &
      VectorDef<
        z.output<TItem>,
        keyof TTable["vectorIndexes"] & string,
        FilterAttrsOf<TTable>
      >;
  },
  CreateCheck<
    z.input<TItem>,
    z.output<TCreate> &
      KeyOf<z.output<TItem>, TPartition[number] | TSort[number]> &
      TOnCreate &
      TOnWrite
  >,
  [TGenArgs] extends [never] ? never : z.output<TGenArgs>
> => {
  const raw = def as unknown as RawTableDef;
  const compiled = compileTable(raw);
  // キーのフィールドは compileTable が先に確かめる（キーは default も使えない）
  assertReparseable(def.item, `entity "${def.entity}" item`);
  if (def.create)
    assertReparseable(def.create, `entity "${def.entity}" create`);
  return {
    kind: "table",
    table: def.table,
    entity: def.entity,
    item: def.item,
    create: def.create,
    key: { partition: def.key.partition, sort: (def.key.sort ?? []) as TSort },
    indexes: (def.indexes ?? {}) as TIndexes,
    vectors: (def.vectors ?? {}) as never,
    immutable: (def.immutable ?? []) as readonly string[],
    ifUnchanged: def.ifUnchanged ?? "optional",
    onCreate: def.onCreate as TableConfig["onCreate"],
    onWrite: def.onWrite as TableConfig["onWrite"],
    generateKey: def.generateKey?.key as TableConfig["generateKey"],
    generateKeyArgs: def.generateKey?.args,
    $createCheck: undefined as never,
    _compiled: compiled,
    _raw: raw,
  };
};

/**
 * ベクトルの実行時の設定（スロットとフィルターを選ぶ関数）を、Table 定義に合わせる。
 * `createRepository` の `vectors` が使う
 */
export const withVectorRuntime = <TT extends AnyTableConfig>(
  table: TT,
  runtimeVectors: Record<string, VectorImpl<any> | undefined> | undefined,
): TT => {
  const vectors: RawTableDef["vectors"] = {};
  for (const [name, vec] of Object.entries(table._raw.vectors ?? {})) {
    const runtime = runtimeVectors?.[name];
    vectors[name] = {
      ...vec,
      slot: runtime?.slot ?? vec.slot,
      filters: runtime?.filters ?? vec.filters,
    };
  }
  for (const name of Object.keys(runtimeVectors ?? {})) {
    if (!table._compiled.vectors.has(name)) {
      throw new DefinitionError(
        `entity "${table.entity}": unknown vector "${name}" in the runtime config`,
      );
    }
  }
  const raw: RawTableDef = { ...table._raw, vectors };
  return {
    ...table,
    _raw: raw,
    _compiled: compileTable(raw, { implemented: true }),
  };
};

export type RawTableDef = {
  table: AnyPhysicalTable;
  entity: string;
  item: z.ZodType;
  key: { partition: readonly string[]; sort?: readonly string[] };
  immutable?: readonly string[];
  indexes?: Record<
    string,
    { slot: string; partition: readonly string[]; sort?: readonly string[] }
  >;
  vectors?: Record<
    string,
    {
      field: string;
      slot?: string | ((row: unknown, ctx: VectorContext) => string);
      partition: readonly string[];
      filters?:
        | Record<string, readonly string[]>
        | ((row: unknown, ctx: VectorContext) => Record<string, string>);
    }
  >;
};

const runtimeSlotMissing = (label: string) => () => {
  throw new DefinitionError(
    `${label}: the slot is chosen at runtime; give vectors.*.slot in createRepository({ vectors })`,
  );
};

const compileTable = (
  def: RawTableDef,
  options: { implemented?: boolean } = {},
): CompiledTable => {
  const { entity, table } = def;
  if (!isValidEntity(entity)) {
    throw new DefinitionError(
      `entity "${entity}" must not be empty or contain "#", "$", spaces, "!", '"' or control characters`,
    );
  }
  const variants = variantsOf(def.item);
  const fieldNames = new Set<string>();
  for (const v of variants) for (const f of v.keys()) fieldNames.add(f);

  for (const f of fieldNames) {
    if (table.reservedAttributes.has(f)) {
      throw new DefinitionError(
        `entity "${entity}": field "${f}" collides with a reserved attribute name`,
      );
    }
  }

  const encoders = new Map<string, FieldEncoder>();
  /** キーのフィールドがキーにできる種類かを確かめる。`beginsWith` はすべてのvariantで文字列の場合だけ使える */
  const registerKeyField = (field: string, base: boolean, label: string) => {
    const holders = variants.filter((v) => v.has(field));
    if (holders.length === 0) {
      throw new DefinitionError(`${label}: unknown field "${field}"`);
    }
    if (base && holders.length !== variants.length) {
      throw new DefinitionError(
        `${label}: field "${field}" must exist in every variant of the item`,
      );
    }
    for (const v of holders) {
      const encoder = encoderFor(primarySchema(v.get(field)!), field, {
        allowOptional: !base,
      });
      const existing = encoders.get(field);
      if (!existing || (existing.isString && !encoder.isString)) {
        encoders.set(field, encoder);
      }
    }
  };

  const partitionFields = def.key.partition;
  const sortFields = def.key.sort ?? [];
  if (partitionFields.length === 0) {
    throw new DefinitionError(
      `entity "${entity}": key.partition must have at least one field`,
    );
  }
  for (const f of [...partitionFields, ...sortFields]) {
    registerKeyField(f, true, `entity "${entity}" key`);
  }
  const keyFields = [...partitionFields, ...sortFields];
  if (new Set(keyFields).size !== keyFields.length) {
    throw new DefinitionError(
      `entity "${entity}": a field appears twice in the key`,
    );
  }

  const indexes = new Map<string, CompiledIndex>();
  const usedSlots = new Set<string>();
  for (const [name, idx] of Object.entries(def.indexes ?? {})) {
    const physical = table.indexes[idx.slot];
    if (!physical) {
      throw new DefinitionError(
        `entity "${entity}" index "${name}": unknown slot "${idx.slot}"`,
      );
    }
    if (usedSlots.has(idx.slot)) {
      throw new DefinitionError(
        `entity "${entity}" index "${name}": slot "${idx.slot}" is already used by another index of this entity`,
      );
    }
    usedSlots.add(idx.slot);
    const sort = idx.sort ?? [];
    for (const f of [...idx.partition, ...sort]) {
      registerKeyField(f, false, `entity "${entity}" index "${name}"`);
    }
    indexes.set(name, {
      name,
      slot: idx.slot,
      physical,
      partition: keyPart(idx.partition, encoders),
      sort: keyPart(sort, encoders),
      fields: new Set([...idx.partition, ...sort]),
    });
  }

  const vectors = new Map<string, CompiledVector>();
  const usedVectorSlots = new Set<string>();
  for (const [name, vec] of Object.entries(def.vectors ?? {})) {
    const label = `entity "${entity}" vector "${name}"`;
    if (!fieldNames.has(vec.field)) {
      throw new DefinitionError(`${label}: unknown field "${vec.field}"`);
    }
    if (typeof vec.slot === "string") {
      if (!table.vectorIndexes[vec.slot]) {
        throw new DefinitionError(`${label}: unknown slot "${vec.slot}"`);
      }
      if (usedVectorSlots.has(vec.slot)) {
        throw new DefinitionError(
          `${label}: slot "${vec.slot}" is already used by another vector of this entity`,
        );
      }
      usedVectorSlots.add(vec.slot);
    }
    if (vec.slot === undefined && options.implemented) {
      throw new DefinitionError(
        `${label}: the slot is chosen at runtime; give vectors.*.slot in createRepository({ vectors })`,
      );
    }
    for (const f of vec.partition) registerKeyField(f, false, label);
    let filters: CompiledVector["filters"] = { kind: "none" };
    if (typeof vec.filters === "function") {
      filters = { kind: "dynamic", build: vec.filters };
    } else if (vec.filters) {
      const spec: Record<string, KeyPart> = {};
      for (const [attr, fields] of Object.entries(vec.filters)) {
        if (
          typeof vec.slot === "string" &&
          !table.vectorIndexes[vec.slot]!.filters.includes(attr)
        ) {
          throw new DefinitionError(
            `${label}: slot "${vec.slot}" has no filter attribute "${attr}"`,
          );
        }
        for (const f of fields) registerKeyField(f, false, label);
        spec[attr] = keyPart(fields, encoders);
      }
      filters = { kind: "static", spec };
    }
    vectors.set(name, {
      name,
      field: vec.field,
      slot: vec.slot ?? runtimeSlotMissing(label),
      partition: keyPart(vec.partition, encoders),
      filters,
      dynamic: typeof vec.slot !== "string" || filters.kind === "dynamic",
    });
  }

  const immutable = new Set(def.immutable ?? []);
  for (const f of immutable) {
    if (!fieldNames.has(f)) {
      throw new DefinitionError(
        `entity "${entity}": immutable field "${f}" does not exist`,
      );
    }
  }

  // キーの検証Schema：各variantのキーのフィールドのSchemaから作り、いずれかを満たせば通す
  const keySchemas = variants.map((v) => {
    const shape: Record<string, z.ZodType> = {};
    for (const f of keyFields) shape[f] = v.get(f)! as z.ZodType;
    return z.strictObject(shape);
  });
  const keySchema =
    keySchemas.length === 1 ? keySchemas[0]! : z.union(keySchemas);

  return {
    entity,
    physical: table,
    variants,
    fieldNames,
    key: {
      partition: keyPart(partitionFields, encoders),
      sort: keyPart(sortFields, encoders),
    },
    keyFields,
    keySchema: keySchema as unknown as z.ZodType<Record<string, unknown>>,
    indexes,
    vectors,
    immutable,
    encoders,
  };
};

export type { FilterSpec };
