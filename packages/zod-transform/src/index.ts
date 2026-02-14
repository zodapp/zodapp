/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 運用上の注意事項（重要）
 *
 * 1. 【副作用禁止】
 *    すべての処理は、同一スキーマ・同一値に対して
 *    複数回実行される可能性がある。
 *    getter / setter / 外部状態参照 / 破壊的変更などの Side Effect を
 *    持つ処理を定義してはならない。
 *
 * 2. 【record のキー制約】
 *    z.record のキーは変換しない。
 *    値のみが transform 対象となる。
 *    recordのキーは、stringで、enumerableなもののみを対象とする。
 *
 * 3. 【object のキー制約】
 *    ZodObject のキーは string で、enumerableなもののみを対象とする。
 *    catchall を含め、Symbol キーは対象外とする
 *    （z.object の仕様に準拠）。
 *
 * 4. 【intersection のマージ仕様】
 *    intersection は left / right を独立して transform し、
 *    shallow merge（{ ...left, ...right }）を行う。
 *    そのため left 側で $remove が発生しても、
 *    right 側で同じキーが存在すれば復活する。
 *
 * 5. 【クラスオブジェクトの扱い】
 *    ZodObject に class instance が与えられた場合、
 *    変換はせず、そのまま通過させる。(enumerableなものも変換しない)
 *
 * 6. 【getter の実行】
 *    object のキーに getter が定義されている場合、
 *    Object.entries 等により getter が実行される。
 *    getter に副作用がある設計は避けること。
 *
 * 7. 【catch の前提】
 *    z.catch の catchValue は、Zod の型契約上 innerType を満たす値を
 *    返すことが期待されている。
 *    本実装もそれを前提とし、これに違反する schema の挙動は保証しない。
 *    catchの対象に、unionが含まれている場合、unionのすべての要素に当てはまらなければcatchが呼ばれるが、
 *    その際のエラー情報は、本来のzodのエラー情報と異なるので注意。
 *
 * 8. 【暗黙的な呼び出し】
 *    "nullable" -> nullだった場合、"null"ハンドラを呼ぶ
 *    "optional" -> undefinedだった場合、"undefined"ハンドラを呼ぶ
 *    ただし、z.defaultの場合は、preprocessでundefinedだった場合に追加で何も呼ばない
 *
 * 9. 【$Removeの挙動】
 *    preprocess / postprocessは、$Removeを渡すことができる。
 *    $Removeは上位オブジェクトでその要素を取り除くが、その挙動はコンテクストによって異なる。
 *    set/map/object/recordの場合は、その要素を完全に取り除く（変更不可）。
 *    array/tupleの場合は、undefinedに変換する。
 *    unionの場合、最終的な戻り値の場合は、undefinedに変換する。
 *    array/tupleの場合の挙動はオプションで変更できる。
 *
 * 設計上の方針
 *
 * 1. preprocess / postprocess は parse の代替ではない。
 *    バリデーション責務は Zod.parse に委ね、
 *    本フレームワークは「構造変換・値変換」にのみ責務を限定する。
 *
 * 2. union / optional / nullable 等の判定のために、
 *    内部的に safeParse を使用する場合があるが、
 *    その結果を preprocess / postprocess の出力に直接混在させることはしない。
 *
 * 3. preprocess は「unknown -> z.infer<T>」の変換
 *    postprocess は「z.infer<T> -> unknown」の変換を行うものとする
 */

import z from "zod";
// import * as core from "zod/v4/core";

// Define type names used in Zod v4
// type ZodTypeNames = core.$ZodTypeDef["type"];

type transformFunctionInternal = (
  obj: any,
  schema: z.ZodTypeAny | z.ZodTypeAny[],
  path?: string | number,
) => any;

type TransformContext = {
  transform: transformFunctionInternal;
  mode: "preprocess" | "postprocess";
  paths: (string | number)[];
};

type SchemaMap = {
  string: z.ZodString;
  number: z.ZodNumber;
  boolean: z.ZodBoolean;
  bigint: z.ZodBigInt;
  date: z.ZodDate;
  symbol: z.ZodSymbol;
  null: z.ZodNull;
  undefined: z.ZodUndefined;
  void: z.ZodVoid;
  nan: z.ZodNaN;
  never: z.ZodNever;
  any: z.ZodAny;
  unknown: z.ZodUnknown;
  literal: z.ZodTypeAny;
  enum: z.ZodTypeAny;
  object: z.ZodObject<z.ZodRawShape>;
  array: z.ZodArray<z.ZodTypeAny>;
  tuple: z.ZodTuple<z.ZodTypeAny[]>;
  record: z.ZodRecord<z.ZodString, z.ZodTypeAny>;
  map: z.ZodMap<z.ZodTypeAny, z.ZodTypeAny>;
  set: z.ZodSet<z.ZodTypeAny>;
  union: z.ZodUnion<z.ZodTypeAny[]>;
  intersection: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>;
  nullable: z.ZodNullable<z.ZodTypeAny>;
  optional: z.ZodOptional<z.ZodTypeAny>;
  default: z.ZodDefault<z.ZodTypeAny>;
  catch: z.ZodCatch<z.ZodTypeAny>;
  readonly: z.ZodReadonly<z.ZodTypeAny>;
  pipe: z.ZodPipe<z.ZodTypeAny, z.ZodTypeAny>;
  lazy: z.ZodLazy<z.ZodTypeAny>;
  promise: z.ZodPromise<z.ZodTypeAny>;
};

type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  bigint: bigint;
  date: Date;
  symbol: symbol;
  null: null;
  undefined: undefined;
  void: void;
  nan: number;
  never: never;
  any: any;
  unknown: unknown;
  literal: any;
  enum: any;
  object: Record<string, unknown>;
  array: unknown[];
  tuple: unknown[];
  record: Record<string, unknown>;
  map: Map<unknown, unknown>;
  set: Set<unknown>;
  union: any;
  intersection: any;
  nullable: any;
  optional: any;
  default: any;
  catch: any;
  readonly: any;
  pipe: any;
  lazy: any;
  promise: any;
};

/**
 * `preprocess()` / `postprocess()` に渡す汎用プロセッサ定義。
 *
 * Zod の schema 種別ごとに、値を走査・変換する関数を定義します。
 * `context.mode` により preprocess/postprocess のどちらの実行フェーズかを判別できます。
 *
 * - **注意**: ここでの変換は parse の代替ではありません。バリデーション自体は Zod に委ねます。
 */
export type ProcessorDef = {
  [K in keyof SchemaMap]?: (
    value: any,
    schema: SchemaMap[K],
    context: TransformContext,
  ) => any;
};

/**
 * `preprocess()` に渡す前処理定義。
 *
 * Zod の schema 種別ごとに、入力値を `z.infer<TSchema>` に寄せるための変換関数を定義します。
 * 「入力が unknown のときに、parse の前に形を整える」用途を想定しています。
 */
export type PreprocessorDef = {
  [K in keyof SchemaMap]?: (value: any, schema: SchemaMap[K]) => TypeMap[K];
};

/**
 * `postprocess()` に渡す後処理定義。
 *
 * Zod の schema 種別ごとに、`z.infer<TSchema>` を任意の出力へ変換する関数を定義します。
 * 「parse の後に、外部入出力向けの表現へ戻す」用途を想定しています。
 */
export type PostprocessorDef = {
  [K in keyof SchemaMap]?: (value: TypeMap[K], schema: SchemaMap[K]) => any;
};

type TransformDef = {
  preprocess?: PreprocessorDef;
  processor?: ProcessorDef;
  postprocess?: PostprocessorDef;
};

/**
 * `preprocess()` / `postprocess()` の動作オプション。
 *
 * `processor` は pre/post の前後いずれでも利用できる共通の変換フックで、
 * 例えば「特定の schema 種別に対して値を正規化する」などの用途に使います。
 */
export type TransformOption = {
  processor: ProcessorDef;
};

const applyPreprocessor = (
  value: unknown,
  schema: z.ZodTypeAny,
  transformDef: TransformDef,
) => {
  const preprocessor =
    transformDef.preprocess?.[schema.type as keyof PreprocessorDef];
  return preprocessor ? preprocessor(value, schema as any) : value;
};

const applyProcessor = (
  value: unknown,
  schema: z.ZodTypeAny,
  transformDef: TransformDef,
  context: TransformContext,
) => {
  const processor = (transformDef.processor?.[
    schema.type as keyof ProcessorDef
  ] || intrinsicProcessorDef[schema.type as keyof ProcessorDef]) as
    | ((value: any, schema: z.ZodTypeAny, context: TransformContext) => any)
    | undefined;
  return processor ? processor(value, schema, context) : value;
};

const applyPostprocessor = (
  value: unknown,
  schema: z.ZodTypeAny,
  transformDef: TransformDef,
) => {
  const postprocessor = transformDef.postprocess?.[
    schema.type as keyof PostprocessorDef
  ] as ((value: any, schema: z.ZodTypeAny) => any) | undefined;
  return postprocessor ? postprocessor(value, schema) : value;
};

/**
 * Transforms an object based on a Zod schema.
 * (preprocess) unknown -> z.infer<TSchema> -> unknown (postprocess)
 * When preprocess is not defined, input object should be in the shape of z.infer<TSchema>.
 * When postprocess is not defined, output object will be in the shape of z.infer<TSchema>.
 *
 * @template TSchema - The Zod schema type.
 * @param obj - The object to be transformed.
 * @param schema - The Zod schema to use for transformation.
 * @param transformDef - An optional object containing preprocess and postprocess functions.
 * @param transformDef.preprocess - A record of functions to preprocess the object before transformation.
 * @param transformDef.postprocess - A record of functions to postprocess the object after transformation.
 * @param customProcessorDef - An optional record of custom transformation functions.
 * @returns The transformed object.
 * @throws Will throw an error if the schema's typeName is not defined.
 */

const isZodTypeArray = (
  schema: z.ZodTypeAny | readonly z.ZodTypeAny[],
): schema is z.ZodTypeAny[] => {
  return Array.isArray(schema);
};

const _preprocess = (
  obj: any,
  schemas: z.ZodTypeAny[] | z.ZodTypeAny,
  transformDef: TransformDef,
  paths: (string | number)[] = [],
) => {
  const errorLogs: {
    schema: z.ZodTypeAny;
    error: z.ZodError;
    value: unknown;
  }[] = [];
  const _schemas = isZodTypeArray(schemas) ? schemas : [schemas];
  for (const schema of _schemas) {
    const preprocessValue = applyPreprocessor(obj, schema, transformDef);
    const processedValue = applyProcessor(
      preprocessValue,
      schema,
      transformDef,
      {
        transform: (value, schema, path) =>
          _preprocess(
            value,
            schema,
            transformDef,
            path !== undefined ? [...paths, path] : paths,
          ),
        mode: "preprocess",
        paths,
      },
    );
    if (_schemas.length > 1) {
      const parseResult = schema.safeParse(
        $Remove.stripRemoveByDefault(processedValue, undefined),
      );
      if (!parseResult.success) {
        errorLogs.push({
          schema,
          error: parseResult.error,
          value: processedValue,
        });
        continue;
      }
    }
    return processedValue;
  }
  throw new z.ZodError([
    {
      code: "invalid_union",
      path: [],
      message: "Not satisfy union schema",
      errors: errorLogs.map((x) => x.error.issues),
    },
  ]);
};

const _postprocess = (
  obj: any,
  schemas: z.ZodTypeAny[] | z.ZodTypeAny,
  transformDef: TransformDef,
  paths: (string | number)[] = [],
) => {
  const errorLogs: {
    schema: z.ZodTypeAny;
    error: z.ZodError;
    value: unknown;
  }[] = [];
  const _schemas = isZodTypeArray(schemas) ? schemas : [schemas];
  for (const schema of _schemas) {
    if (_schemas.length > 1) {
      const parseResult = schema.safeParse(obj);
      if (!parseResult.success) {
        errorLogs.push({
          schema,
          error: parseResult.error,
          value: obj,
        });
        continue;
      }
    }
    const processedValue = applyProcessor(obj, schema, transformDef, {
      transform: (value, schema, path) =>
        _postprocess(
          value,
          schema,
          transformDef,
          path !== undefined ? [...paths, path] : paths,
        ),
      mode: "postprocess",
      paths,
    });
    return applyPostprocessor(processedValue, schema, transformDef);
  }
  throw new z.ZodError([
    {
      code: "invalid_union",
      path: [],
      message: "Not satisfy union schema",
      errors: errorLogs.map((x) => x.error.issues),
    },
  ]);
};

/**
 * Zod の parse 後の値（`z.infer<TSchema>`）を、外部入出力向けの表現へ変換します。
 *
 * `PostprocessorDef` により型ごとの変換を定義できます。必要に応じて `TransformOption.processor` で共通処理も挟めます。
 */
export const postprocess = <TSchema extends z.ZodTypeAny>(
  obj: z.infer<TSchema>,
  schemas: TSchema,
  postprocessor: PostprocessorDef = {},
  transformOption: TransformOption = { processor: {} },
): unknown => {
  const processedValue = _postprocess(
    obj,
    schemas,
    { postprocess: postprocessor, processor: transformOption.processor },
    [],
  );
  return $Remove.stripRemoveByDefault(processedValue, undefined) as unknown;
};

/**
 * `unknown` な入力を、Zod スキーマに合わせた形（`z.infer<TSchema>`）へ前処理します。
 *
 * `PreprocessorDef` により型ごとの変換を定義できます。実際のバリデーションは Zod の `parse` に委ねる想定です。
 */
export const preprocess = <TSchema extends z.ZodTypeAny>(
  obj: unknown,
  schemas: TSchema,
  preprocessor: PreprocessorDef = {},
  transformOption: TransformOption = { processor: {} },
): z.infer<TSchema> => {
  const preprocessedValue = _preprocess(
    obj,
    schemas,
    { preprocess: preprocessor, processor: transformOption.processor },
    [],
  );
  return $Remove.stripRemoveByDefault(preprocessedValue, undefined);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

// 仕様確認のための関数で、実際に使われることはない
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _transform = <TSchema extends z.ZodTypeAny>(
  obj: any,
  schema: TSchema,
  transformDef: TransformDef = {},
) => {
  const preprocessedValue = _preprocess(obj, schema, transformDef);
  const parsedValue = schema.parse(preprocessedValue);
  const postprocessedValue = _postprocess(parsedValue, schema, transformDef);
  return postprocessedValue;
};

// 仕様確認のための関数で、実際に使われることはない
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _safeTransform = <TSchema extends z.ZodTypeAny>(
  obj: any,
  schema: TSchema,
  transformDef: TransformDef = {},
) => {
  try {
    const postprocessedValue = _transform(obj, schema, transformDef);
    return {
      success: true,
      data: postprocessedValue,
    } as const;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        data: undefined,
        error: error,
      } as const;
    }
    throw error;
  }
};

/**
 * Creates an placeholder to remove the value from the parent object.
 *
 * @param originalValue - The original value to be removed.
 * @param contextValue - An optional record of context values.
 * @returns An instance of $Remove.
 */

const $$remove = Symbol("$$remove");

type $RemoveOptions = {
  // $$removeの場合、配列でその要素を取り除く。null | undefined の場合、配列の要素を置き換える。
  array?: null | undefined | typeof $$remove; // default is $$remove
  tuple?: null | undefined; // default is undefined
  default?: null | undefined; // default is undefined
};

class $Remove {
  options: $RemoveOptions;
  private constructor(options?: $RemoveOptions) {
    this.options = {
      array: $$remove,
      tuple: undefined,
      default: undefined,
      ...options,
    };
  }
  static create(options?: $RemoveOptions) {
    return new $Remove(options);
  }
  valueForContext<Key extends keyof $RemoveOptions>(
    contextName: Key,
  ): $RemoveOptions[Key] {
    return this.options[contextName];
  }
  static stripRemove<Key extends keyof $RemoveOptions, V>(
    value: V | $Remove,
    contextName: Key,
  ) {
    if (value instanceof $Remove) {
      return value.valueForContext(contextName);
    }
    return value;
  }
  static stripRemoveByDefault<V>(value: V | $Remove, defaultValue: V) {
    if (value instanceof $Remove) {
      return defaultValue;
    }
    return value;
  }
}

/**
 * 親オブジェクトから値を「取り除く」ためのプレースホルダを作成します。
 *
 * `preprocess()` / `postprocess()` の変換中に返すことで、次のように扱われます。
 * - object: 該当キーを出力から除外
 * - array: 要素を削除（詰める）
 *
 * 返り値は `$Remove` インスタンスです。
 */
export const $remove = $Remove.create;

const intrinsicProcessorDef: ProcessorDef = {
  object: (obj, schema, context) => {
    if (!isPlainObject(obj)) {
      return obj;
    }
    const newObj: Record<string, unknown> = Object.create(null);
    for (const key of Array.from(
      new Set([...Object.keys(obj), ...Object.keys(schema.shape)]),
    )) {
      const value = obj[key];
      const result = schema.shape[key]
        ? context.transform(value, schema.shape[key] as z.ZodTypeAny, key)
        : schema.def.catchall
          ? context.transform(value, schema.def.catchall as z.ZodTypeAny, key)
          : value;
      if (!(result instanceof $Remove)) {
        newObj[key] = result;
      }
    }
    return newObj;
  },
  set: (obj, schema, context) => {
    if (!(obj instanceof Set)) return obj;
    const valueType = schema.def.valueType;
    return new Set(
      Array.from(obj)
        .map((value: unknown) =>
          context.transform(value, valueType, `:setValue`),
        )
        .filter((value) => !(value instanceof $Remove)),
    );
  },
  array: (obj: unknown[], schema, context) => {
    if (!Array.isArray(obj)) return obj;
    const element = schema.def.element;
    return obj
      .map((value, index) => {
        const result = context.transform(value, element as z.ZodTypeAny, index);
        return $Remove.stripRemove(result, "array");
      })
      .filter((value) => value !== $$remove);
  },
  tuple: (obj, schema, context) => {
    if (!Array.isArray(obj)) return obj;
    return obj.map((value: unknown, index: number) => {
      const itemSchema = schema.def.items[index];
      if (itemSchema) {
        const result = context.transform(value, itemSchema, index);
        return $Remove.stripRemove(result, "tuple");
      } else {
        return value;
      }
    });
  },
  union: (obj, schema, context) => {
    const options = schema.def.options;
    return context.transform(obj, options);
  },
  intersection: (obj, schema, context) => {
    if (typeof obj !== "object" || obj === null) return obj;
    const left = schema.def.left;
    const right = schema.def.right;

    return {
      ...$Remove.stripRemoveByDefault(context.transform(obj, left), undefined),
      ...$Remove.stripRemoveByDefault(context.transform(obj, right), undefined),
    };
  },
  // Recordのキーは変換しない
  record: (obj, schema, context) => {
    if (typeof obj !== "object" || obj === null) return obj;
    const newObj: Record<string | symbol, unknown> = Object.create(null);
    for (const [key, value] of Object.entries(obj)) {
      const valueResult = context.transform(value, schema.def.valueType, key);
      if (!(valueResult instanceof $Remove)) {
        newObj[key] = valueResult;
      }
    }
    return newObj;
  },
  map: (obj, schema, context) => {
    if (!(obj instanceof Map)) return obj;
    const newObj = new Map<unknown, unknown>();
    for (const [key, value] of obj.entries()) {
      const valueResult = context.transform(
        value,
        schema.def.valueType,
        `:mapValue`,
      );
      const keyResult = context.transform(key, schema.def.keyType, `:mapKey`);
      if (
        !(valueResult instanceof $Remove) &&
        !(keyResult instanceof $Remove)
      ) {
        newObj.set(keyResult, valueResult);
      }
    }
    return newObj;
  },
  nullable: (obj, schema, context) => {
    // z.nullを呼ぶことで、nullのハンドラを呼ぶ
    const innerType = schema.def.innerType;
    return context.transform(obj, [z.null(), innerType]);
  },
  optional: (obj, schema, context) => {
    // z.undefinedを呼ぶことで、undefinedのハンドラを呼ぶ
    const innerType = schema.def.innerType;
    return context.transform(obj, [z.undefined(), innerType]);
  },
  default: (obj, schema, context) => {
    const innerType = schema.def.innerType;
    if (context.mode === "preprocess") {
      if (obj === undefined) {
        return obj;
      } else {
        return context.transform(obj, innerType);
      }
    } else {
      return context.transform(obj, innerType);
    }
  },
  // transformer内のunion等で、parseErrorになった場合、catchValueが呼ばれるが、その際のエラー情報は、
  // 本来のzodのエラー情報とは異なる場合があるので注意。
  catch: (obj, schema, context) => {
    const innerType = schema.def.innerType;
    if (context.mode === "preprocess") {
      try {
        return context.transform(obj, innerType);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const zodError = error as z.ZodError;
          return schema.def.catchValue({
            error: zodError,
            input: obj,
            issues: zodError.issues.map((issue: z.ZodIssue) => {
              return {
                ...issue,
                input: obj,
              };
            }),
            value: obj,
          });
        }
        throw error;
      }
    }
    // postprocess は parse 後なので、catchValue は既に適用済みの前提。catchValueは、
    // innerTypeを満たすとして仮定して良いので、そのままinnerTypeで、postprocessを続行する。
    return context.transform(obj, innerType);
  },
  readonly: (obj, schema, context) => {
    const innerType = schema.def.innerType;
    return context.transform(obj, innerType);
  },
  pipe: (obj, schema, context) => {
    if (context.mode === "preprocess") {
      return context.transform(obj, schema.in);
    } else {
      return context.transform(obj, schema.out as z.ZodTypeAny);
    }
  },
  lazy: (obj, schema, context) => {
    const getter = schema.def.getter;
    return context.transform(obj, getter());
  },
};
