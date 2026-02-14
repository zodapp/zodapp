/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import z from "zod";
import {
  zodPropagatingRegistry,
  getMeta as getMetaIntrinsic,
  type ZodPropagatingRegistryType,
} from "@zodapp/zod-propagating-registry";

import { type MetaOf } from "@zodapp/zod-propagating-registry";
export type { MetaOf };

const zodExtendableRegistryKey = Symbol.for("zodExtendable");

/**
 * zod-extendable registry に登録されたメタデータを取得します。
 *
 * `TRegistry` を指定すると、registry が付与するメタ型（`MetaOf<TRegistry>`）に合わせて返り値が推論されます。
 */
export const getMeta = <
  S extends z.ZodTypeAny,
  TRegistry extends ZodPropagatingRegistryType<any, any, any>,
>(
  schema: S,
) => {
  return getMetaIntrinsic<S, MetaOf<TRegistry>>(
    schema,
    zodExtendableRegistryKey,
  );
};

/**
 * 型推論用センチネル。
 *
 * 実行時には参照されず、常に `undefined` を返します（型だけを与えたい場面で使用）。
 */
export const schemaType = <S extends z.ZodType>() => undefined as unknown as S;

const getRegistry = <
  TMeta extends object,
  TTargetSchema extends z.ZodType,
  TTypeName extends string,
>(
  typeName: TTypeName,
) => {
  return zodPropagatingRegistry<
    TMeta,
    TTargetSchema,
    {
      typeName: TTypeName;
    }
  >(zodExtendableRegistryKey, {
    typeName,
  });
};

/**
 * 任意の Zod factory を「メタ付き」に拡張します。
 *
 * `factory` をラップし、生成される schema に対して `registry` を介したメタ付与ができるようにします。
 * 返り値の factory には `registry` プロパティが追加されます。
 */
export const extendCustom = <
  TMeta extends object,
  TFactory extends (...args: any[]) => z.ZodType,
  TTypeName extends string,
  TTargetSchema extends z.ZodType = ReturnType<TFactory>,
>(
  factory: TFactory,
  typeName: TTypeName,
  _metaSchema?: z.ZodType<TMeta>,
  _targeSchema?: TTargetSchema,
) => {
  const registry = getRegistry<TMeta, TTargetSchema, TTypeName>(typeName);
  const derivedFactory = ((...args: Parameters<TFactory>) => {
    return factory(...args);
  }) as TFactory & { registry: typeof registry };
  derivedFactory.registry = registry;
  return derivedFactory;
};

/**
 * `z.literal()` をメタ付きに拡張します。
 */
export const extendLiteral = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.literal, "literal", metaSchema);

/**
 * `z.string()` をメタ付きに拡張します。
 */
export const extendString = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) =>
  extendCustom(
    z.string,
    "string",
    metaSchema,
    schemaType<z.ZodString | z.ZodStringFormat>(),
  );

/**
 * `z.number()` をメタ付きに拡張します。
 */
export const extendNumber = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.number, "number", metaSchema);

/**
 * `z.bigint()` をメタ付きに拡張します。
 */
export const extendBigint = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.bigint, "bigint", metaSchema);

/**
 * `z.date()` をメタ付きに拡張します。
 */
export const extendDate = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.date, "date", metaSchema);

/**
 * `z.boolean()` をメタ付きに拡張します。
 */
export const extendBoolean = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) =>
  extendCustom(
    z.boolean,
    "boolean",
    metaSchema,
    schemaType<z.ZodBoolean | z.ZodLiteral<boolean>>(),
  );

/**
 * `z.array()` をメタ付きに拡張します。
 */
export const extendArray = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.array, "array", metaSchema);

/**
 * `z.tuple()` をメタ付きに拡張します。
 */
export const extendTuple = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.tuple, "tuple", metaSchema, schemaType<z.ZodTuple>());

/**
 * `z.record()` をメタ付きに拡張します。
 */
export const extendRecord = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.record, "record", metaSchema);

/**
 * `z.set()` をメタ付きに拡張します。
 */
export const extendSet = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.set, "set", metaSchema);

/**
 * `z.object()` をメタ付きに拡張します。
 */
export const extendObject = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.object, "object", metaSchema);

/**
 * `z.union()` をメタ付きに拡張します。
 */
export const extendUnion = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => extendCustom(z.union, "union", metaSchema);

/**
 * `z.enum()` をメタ付きに拡張します。
 *
 * `z.literal(\"A\")` の配列から enum を生成し、各 literal schema もメタに保持します。
 */
export const extendEnum = <TMeta extends object>(
  metaSchema?: z.ZodType<TMeta>,
) => {
  const enumRegistry = getRegistry<
    Partial<TMeta> & { schemas?: Record<string, z.ZodLiteral<string>> },
    z.ZodEnum<any>,
    "enum"
  >("enum");

  const enumFactory = <
    TItems extends readonly [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]],
  >(
    literals: TItems,
    params?: Parameters<typeof z.enum>[1],
  ): z.ZodEnum<z.core.util.ToEnum<TItems[number]["value"]>> => {
    const values = literals.map((lit) => lit.value) as [
      TItems[0]["value"],
      ...TItems[number]["value"][],
    ];
    const schemas = Object.fromEntries(
      values.map((v, i) => [v, literals[i]]),
    ) as Record<string, z.ZodLiteral<string>>;
    return z.enum(values, params).register(enumRegistry, { schemas } as any);
  };

  const derivedFactory = enumFactory as typeof enumFactory & {
    registry: typeof enumRegistry;
  };

  // expose enum registry only（literal は extendCustom(z.literal, "literal", ...) を利用）
  derivedFactory.registry = enumRegistry;
  return derivedFactory;
};
