import * as z from "zod";

const getDef = <
  S extends z.ZodTypeAny,
  Meta extends object | undefined = object | undefined,
>(
  schema: S,
) => {
  return schema._zod.def as unknown as {
    [key: string | symbol]: z.core.$replace<Meta, S> | undefined;
  };
};

class ZodPropagatingRegistry<
  Meta extends object | undefined = object | undefined,
  SchemaType extends z.ZodTypeAny = z.ZodTypeAny,
  FixedMeta = unknown,
> extends z.core.$ZodRegistry<Meta, SchemaType> {
  private metaIdKey: symbol;
  public fixedMeta?: FixedMeta;
  constructor(name: string | symbol, fixedMeta?: FixedMeta) {
    super();
    if (typeof name === "symbol") {
      this.metaIdKey = name;
    } else {
      this.metaIdKey = Symbol.for(name);
    }
    this.fixedMeta = fixedMeta;
  }

  private getDef(ZodType: SchemaType) {
    return getDef<SchemaType, Meta>(ZodType);
  }

  override add<S extends SchemaType>(
    schema: S,
    ..._meta: undefined extends Meta
      ? [z.core.$replace<Meta, S>?]
      : [z.core.$replace<Meta, S>]
  ): this {
    const def = this.getDef(schema);
    const currentMeta = (def[this.metaIdKey] ?? {}) as z.core.$replace<Meta, S>;
    def[this.metaIdKey] = {
      ...currentMeta,
      ...(this.fixedMeta ?? {}),
      ...(_meta[0] ?? {}),
    };
    return this;
  }

  override clear(): this {
    throw new Error("Not implemented");
  }

  override remove(schema: SchemaType): this {
    const def = this.getDef(schema);
    delete def[this.metaIdKey];
    return this;
  }

  override get<S extends SchemaType>(
    schema: S,
  ): z.core.$replace<Meta, S> | undefined {
    const def = this.getDef(schema);
    return def[this.metaIdKey];
  }

  getExtended<S extends SchemaType>(
    schema: S,
  ): (FixedMeta & z.core.$replace<Meta, S>) | undefined {
    return this.get(schema) as
      | (FixedMeta & z.core.$replace<Meta, S>)
      | undefined;
  }

  override has(schema: SchemaType): boolean {
    const def = this.getDef(schema);
    return def[this.metaIdKey] !== undefined;
  }
}

/**
 * メタデータが「伝播（merge）」する Zod registry の公開型。
 *
 * `add(schema, meta)` を複数回呼ぶと、既存メタへ追加分が shallow merge されます。
 * `getExtended()` は registry 固定メタ（`fixedMeta`）と、schema に付与したメタを合成した値を返します。
 *
 * - **Meta**: schema に付与するメタの型
 * - **SchemaType**: 対象とする Zod schema の型
 * - **FixedMeta**: registry 作成時に固定で付与されるメタの型
 */
export type ZodPropagatingRegistryType<
  Meta extends object | undefined = object | undefined,
  SchemaType extends z.ZodTypeAny = z.ZodTypeAny,
  FixedMeta = unknown,
> = z.core.$ZodRegistry<Meta, SchemaType> & {
  getExtended: <S extends SchemaType>(
    schema: S,
  ) => (FixedMeta & z.core.$replace<Meta, S>) | undefined;
};

/**
 * メタデータが伝播（merge）する registry を作成します。
 *
 * 同じ schema に対して `add()` を複数回呼ぶとメタが浅くマージされ、上書き/拡張できます。
 * `fixedMeta` を渡すと、常に `getExtended()` の結果へ含まれます。
 */
export const zodPropagatingRegistry = <
  Meta extends object | undefined = object | undefined,
  SchemaType extends z.ZodTypeAny = z.ZodTypeAny,
  FixedMeta = unknown,
>(
  name: string | symbol,
  fixedMeta?: FixedMeta,
) => {
  return new ZodPropagatingRegistry<Meta, SchemaType>(
    name,
    fixedMeta,
  ) as ZodPropagatingRegistryType<Meta, SchemaType, FixedMeta>;
};

/**
 * schema に付与されたメタデータを取得します。
 *
 * `metaIdKey` は `zodPropagatingRegistry()` に渡した name（string の場合は `Symbol.for(name)`）と一致させます。
 */
export const getMeta = <
  S extends z.ZodTypeAny,
  Meta extends object | undefined = object | undefined,
>(
  schema: S,
  metaIdKey: symbol,
) => {
  return getDef<S, Meta>(schema)[metaIdKey] as Meta;
};

/**
 * `ZodPropagatingRegistryType` から「付与されるメタ型」を取り出すユーティリティ型。
 *
 * `fixedMeta`（固定メタ）も含めて合成された型として返します。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MetaOf<Registry extends ZodPropagatingRegistryType<any, any, any>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Registry extends ZodPropagatingRegistryType<infer Meta, any, infer FixedMeta>
    ? (NonNullable<Meta> & FixedMeta) | undefined
    : never;
