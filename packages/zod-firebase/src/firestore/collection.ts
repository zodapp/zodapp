import {
  cloneSchema,
  getMeta,
  hideSchemaFields,
  replaceDiscriminatedUnionOptions,
  replaceIntersectionSides,
  replaceObjectShape,
  replaceUnionOptions,
  unwrapSchema,
  zf,
} from "@zodapp/zod-form";
import {
  CollectionPathKeyFromPath,
  CollectionPathParamsFromPath,
  compilePath,
  DocumentKeyFromPath,
  DocumentPathKeyFromPath,
  DocumentPathParamsFromPath,
} from "./pathUtil";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZodObject = z.ZodObject<any>;
type EmptyShape = Record<never, z.ZodTypeAny>;

/**
 * CollectionConfig のブランドシンボル
 * collectionConfig() で生成された値であることを型レベルで保証する
 */
declare const CollectionConfigBrand: unique symbol;

/**
 * ブランド付き CollectionConfig の型
 * collectionConfig() の戻り値のみを受け入れるために使用
 */
export type BrandedCollectionConfig = {
  readonly [CollectionConfigBrand]: true;
};

type NonPathKeysOf<Path extends string, FieldKeys extends string> = Exclude<
  FieldKeys,
  DocumentPathKeyFromPath<Path>
>;

type DocumentIdentityKey<Path extends string, FieldKeys extends string> =
  | DocumentPathKeyFromPath<Path>
  | NonPathKeysOf<Path, FieldKeys>;

type DocumentIdentity<Path extends string, FieldKeys extends string> = {
  [K in DocumentIdentityKey<Path, FieldKeys>]: string;
};

type CollectionIdentity<
  Path extends string,
  FieldKeys extends string,
> = CollectionPathParamsFromPath<Path> &
  Record<NonPathKeysOf<Path, FieldKeys>, string>;

export type CollectionDefinition<
  Path extends string,
  FieldKeys extends string = never,
  IntrinsicSchema extends z.ZodTypeAny = z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
  CreateOmitKeys extends string = never,
> = {
  path: Path;
  fieldKeys?: readonly FieldKeys[];
  schema: IntrinsicSchema;
  createExcludedSchema?: z.ZodObject<CreateExcludedShape>;
  /**
   * @deprecated `createExcludedSchema` を使ってください。
   */
  createOmitKeys?: readonly CreateOmitKeys[];
  onInit?: () => Partial<z.infer<IntrinsicSchema>>;
  onCreateId?: (
    collectionIdentity: CollectionIdentity<Path, FieldKeys>,
    inputData: z.infer<IntrinsicSchema>,
  ) => string | undefined;
  onCreate?: (
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    inputData: z.infer<IntrinsicSchema>,
  ) => Partial<Record<string, unknown>> | void;
  onWrite?: (
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    data: Partial<Record<string, unknown>>,
  ) => Partial<Record<string, unknown>> | void;
};

type CollectionIdentityKeys<Path extends string, FieldKeys extends string> =
  | CollectionPathKeyFromPath<Path>
  | NonPathKeysOf<Path, FieldKeys>;

type IsAny<T> = 0 extends 1 & T ? true : false;

type SafeMappedType<Keys extends string, Value> =
  IsAny<Keys> extends true
    ? unknown
    : [Keys] extends [never]
      ? unknown
      : { [K in Keys]: Value };

type SafeOptionalMappedType<Keys extends string, Value> =
  IsAny<Keys> extends true
    ? unknown
    : [Keys] extends [never]
      ? unknown
      : { [K in Keys]?: Value };

type NonPathKeySchemaFor<Path extends string, FieldKeys extends string> = [
  NonPathKeysOf<Path, FieldKeys>,
] extends [never]
  ? z.ZodUnknown
  : z.ZodObject<{ [K in NonPathKeysOf<Path, FieldKeys>]: z.ZodString }>;

type AsIsObjectTypeOf<Shape extends z.ZodRawShape> = [keyof Shape] extends [never]
  ? unknown
  : z.infer<z.ZodObject<Shape>>;

type DataTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.infer<IntrinsicSchema> &
  SafeMappedType<DocumentIdentityKey<Path, FieldKeys>, string> &
  AsIsObjectTypeOf<CreateExcludedShape>;

type UpdateTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.infer<IntrinsicSchema> &
  SafeOptionalMappedType<
    Exclude<DocumentIdentityKey<Path, FieldKeys>, FieldKeys>,
    string
  > &
  SafeOptionalMappedType<FieldKeys, string> &
  AsIsObjectTypeOf<CreateExcludedShape>;

type StoreTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.infer<IntrinsicSchema> &
  SafeMappedType<NonPathKeysOf<Path, FieldKeys>, string> &
  AsIsObjectTypeOf<CreateExcludedShape>;

type MergeMode = "appendOptional" | "appendRequired" | "appendAsIs";

const EMPTY_OBJECT_SCHEMA = z.object({});

const isEmptyShape = (shape: z.ZodRawShape) => Object.keys(shape).length === 0;

const pickShapeKeys = (
  shape: z.ZodRawShape,
  keys: readonly string[],
): z.ZodRawShape =>
  Object.fromEntries(
    keys
      .filter((key) => key in shape)
      .map((key) => [key, shape[key] as z.ZodTypeAny]),
  ) as z.ZodRawShape;

const omitShapeKeys = (
  shape: z.ZodRawShape,
  keys: readonly string[],
): z.ZodRawShape => {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(shape).filter(([key]) => !keySet.has(key)),
  ) as z.ZodRawShape;
};

const hiddenString = (optional = false) =>
  (optional ? z.string().optional() : z.string()).register(
    zf.hidden.registry,
    {},
  );

const materializeRequiredField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString();
  if (!(schema instanceof z.ZodOptional)) return schema;

  const inner = schema.unwrap() as z.ZodTypeAny;
  const optionalMeta = getMeta(schema as z.ZodTypeAny);
  const isHidden =
    optionalMeta?.typeName === "hidden" || optionalMeta?.hidden;
  const cloned = cloneSchema(inner);
  if (isHidden) {
    cloned.register(zf.hidden.registry, {
      ...(optionalMeta?.label ? { label: optionalMeta.label } : {}),
    });
  }
  return cloned;
};

const materializeOptionalField = (schema?: z.ZodTypeAny): z.ZodTypeAny => {
  if (!schema) return hiddenString(true);
  if (schema instanceof z.ZodOptional) return schema;

  const label = getMeta(schema as z.ZodTypeAny)?.label;
  const optional = schema.optional();
  optional.register(zf.hidden.registry, {
    ...(label ? { label } : {}),
  });
  return optional;
};

const mergeSchemaRecursively = (
  base: z.ZodTypeAny,
  delta: AnyZodObject,
  mode: MergeMode,
  contextLabel: string,
  preferExistingOnOverlap = false,
): z.ZodTypeAny => {
  if (isEmptyShape(delta.shape)) return base;

  const { inner, rewrap } = unwrapSchema(base);

  if (inner instanceof z.ZodObject) {
    const nextShape = Object.fromEntries(
      Object.entries(delta.shape).map(([key, schema]) => {
        const sourceSchema =
          preferExistingOnOverlap && inner.shape[key]
            ? (inner.shape[key] as z.ZodTypeAny)
            : (schema as z.ZodTypeAny);
        return [
          key,
          mode === "appendOptional"
            ? materializeOptionalField(sourceSchema)
            : mode === "appendRequired"
              ? materializeRequiredField(sourceSchema)
              : sourceSchema,
        ];
      }),
    ) as z.ZodRawShape;
    const mergedShape = {
      ...inner.shape,
      ...nextShape,
    };
    return rewrap(
      replaceObjectShape(inner as AnyZodObject, mergedShape, {
        properties: Object.keys(mergedShape),
      }),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) =>
      mergeSchemaRecursively(
        option,
        delta,
        mode,
        contextLabel,
        preferExistingOnOverlap,
      ),
    ) as [AnyZodObject, AnyZodObject, ...AnyZodObject[]];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(inner.options as readonly z.ZodTypeAny[]).map(
      (option) =>
        mergeSchemaRecursively(
          option,
          delta,
          mode,
          contextLabel,
          preferExistingOnOverlap,
        ),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = mergeSchemaRecursively(
      inner._def.left as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
      preferExistingOnOverlap,
    );
    const right = mergeSchemaRecursively(
      inner._def.right as z.ZodTypeAny,
      delta,
      mode,
      contextLabel,
      preferExistingOnOverlap,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw new Error(
    `[collectionConfig] ${contextLabel} only supports ZodObject, ZodUnion, ` +
      `ZodDiscriminatedUnion, ZodIntersection, and their wrappers.`,
  );
};

const stripKeysRecursively = (
  schema: z.ZodTypeAny,
  keys: readonly string[],
  contextLabel: string,
): z.ZodTypeAny => {
  if (keys.length === 0) return schema;

  const { inner, rewrap } = unwrapSchema(schema);

  if (inner instanceof z.ZodObject) {
    const nextShape = omitShapeKeys(inner.shape, keys);
    return rewrap(
      replaceObjectShape(inner as AnyZodObject, nextShape, {
        properties: Object.keys(nextShape),
      }),
    );
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const nextOptions = Array.from(
      inner.options as readonly AnyZodObject[],
    ).map((option) => stripKeysRecursively(option, keys, contextLabel)) as [
      AnyZodObject,
      AnyZodObject,
      ...AnyZodObject[],
    ];
    return rewrap(replaceDiscriminatedUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodUnion) {
    const nextOptions = Array.from(inner.options as readonly z.ZodTypeAny[]).map(
      (option) => stripKeysRecursively(option, keys, contextLabel),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];
    return rewrap(replaceUnionOptions(inner, nextOptions));
  }

  if (inner instanceof z.ZodIntersection) {
    const left = stripKeysRecursively(
      inner._def.left as z.ZodTypeAny,
      keys,
      contextLabel,
    );
    const right = stripKeysRecursively(
      inner._def.right as z.ZodTypeAny,
      keys,
      contextLabel,
    );
    return rewrap(replaceIntersectionSides(inner, left, right));
  }

  throw new Error(
    `[collectionConfig] ${contextLabel} only supports ZodObject, ZodUnion, ` +
      `ZodDiscriminatedUnion, ZodIntersection, and their wrappers.`,
  );
};

const pickLegacyCreateExcludedSchema = (
  schema: z.ZodTypeAny,
  keys: readonly string[],
  pathLabel: string,
): AnyZodObject => {
  if (keys.length === 0) return EMPTY_OBJECT_SCHEMA;

  const { inner } = unwrapSchema(schema);
  if (!(inner instanceof z.ZodObject)) {
    throw new Error(
      `[collectionConfig] createOmitKeys requires top-level schema to be ZodObject ${pathLabel}. ` +
        `Use createExcludedSchema when schema is union/intersection based.`,
    );
  }

  for (const key of keys) {
    if (!(key in inner.shape)) {
      throw new Error(
        `[collectionConfig] createOmitKey "${key}" must be a key of schema ${pathLabel}`,
      );
    }
  }

  return z.object(pickShapeKeys(inner.shape, keys));
};


export const getCollectionConfigBare = <
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
  CreateOmitKeys extends string = never,
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape,
    CreateOmitKeys
  >,
) => {
  const pathUtils = compilePath(config.path);
  const fieldKeys = (config.fieldKeys ?? []) as readonly FieldKeys[];
  const createOmitKeys = (config.createOmitKeys ??
    []) as readonly CreateOmitKeys[];
  const nonPathKeys = fieldKeys.filter(
    (key) => !(pathUtils.documentPathKeys as readonly string[]).includes(key),
  ) as unknown as readonly NonPathKeysOf<Path, FieldKeys>[];

  const documentIdentityKeys = [
    ...pathUtils.documentPathKeys,
    ...nonPathKeys,
  ] as readonly DocumentIdentityKey<Path, FieldKeys>[];
  const collectionIdentityKeys = [
    ...pathUtils.collectionPathKeys,
    ...nonPathKeys,
  ] as readonly CollectionIdentityKeys<Path, FieldKeys>[];

  const pathLabel = `(path: "${config.path}")`;

  const nonPathKeySchema = (
    nonPathKeys.length === 0
      ? z.unknown()
      : z.object(
          Object.fromEntries(
            nonPathKeys.map((key: string) => [key, z.string()]),
          ),
        )
  ) as NonPathKeySchemaFor<Path, FieldKeys>;

  const collectionIdentitySchema = (
    nonPathKeys.length > 0
      ? pathUtils.collectionPathSchema.merge(nonPathKeySchema as AnyZodObject)
      : pathUtils.collectionPathSchema
  ) as z.ZodObject<{
    [K in
      | CollectionPathKeyFromPath<Path>
      | NonPathKeysOf<Path, FieldKeys>]: z.ZodString;
  }>;

  const documentIdentitySchema = z.object(
    Object.fromEntries(
      documentIdentityKeys.map((key: string) => [key, z.string()]),
    ),
  ) as z.ZodObject<{
    [K in DocumentIdentityKey<Path, FieldKeys>]: z.ZodString;
  }>;

  const legacyCreateExcludedSchema = pickLegacyCreateExcludedSchema(
    config.schema,
    createOmitKeys,
    pathLabel,
  );
  const effectiveCreateExcludedSchema = mergeSchemaRecursively(
    legacyCreateExcludedSchema,
    config.createExcludedSchema ?? EMPTY_OBJECT_SCHEMA,
    "appendAsIs",
    "createExcludedSchema merge",
  ) as AnyZodObject;

  const intrinsicSchema = config.schema;
  const fieldKeySchema = z.object(
    Object.fromEntries(fieldKeys.map((key) => [key, z.string()])),
  );

  const dataSchemaBeforeHide = mergeSchemaRecursively(
    intrinsicSchema,
    documentIdentitySchema,
    "appendRequired",
    "dataSchema auto identity merge",
    true,
  );
  const dataSchema = hideSchemaFields(dataSchemaBeforeHide, {
    paths: documentIdentityKeys as unknown as string[],
  }) as z.ZodType<
    DataTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const dataSchemaWithCreateExcluded = mergeSchemaRecursively(
    dataSchema,
    effectiveCreateExcludedSchema,
    "appendAsIs",
    "dataSchema createExcluded merge",
  ) as z.ZodType<
    DataTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const updateSchemaBeforeHide = mergeSchemaRecursively(
    mergeSchemaRecursively(
      intrinsicSchema,
      documentIdentitySchema,
      "appendOptional",
      "updateSchema auto identity merge",
      true,
    ),
    fieldKeySchema,
    "appendOptional",
    "updateSchema fieldKeys merge",
    true,
  );
  const updateSchema = hideSchemaFields(updateSchemaBeforeHide, {
    paths: documentIdentityKeys as unknown as string[],
  }) as z.ZodType<
    UpdateTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const updateSchemaWithCreateExcluded = mergeSchemaRecursively(
    updateSchema,
    effectiveCreateExcludedSchema,
    "appendAsIs",
    "updateSchema createExcluded merge",
  ) as z.ZodType<
    UpdateTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const storeSchemaWithFieldKeys = mergeSchemaRecursively(
    stripKeysRecursively(
      intrinsicSchema,
      pathUtils.documentPathKeys.filter(
        (key) => !(fieldKeys as readonly string[]).includes(key),
      ),
      "storeSchema strip",
    ),
    fieldKeySchema,
    "appendRequired",
    "storeSchema fieldKeys merge",
    true,
  );

  const storeSchemaBeforeHide = mergeSchemaRecursively(
    storeSchemaWithFieldKeys,
    effectiveCreateExcludedSchema,
    "appendAsIs",
    "storeSchema createExcluded merge",
  );
  const identityKeysInStore = (fieldKeys as readonly string[]).filter(
    (key) => documentIdentityKeys.includes(key as DocumentIdentityKey<Path, FieldKeys>),
  );
  const storeSchema = (
    identityKeysInStore.length > 0
      ? hideSchemaFields(storeSchemaBeforeHide, {
          paths: identityKeysInStore,
        })
      : storeSchemaBeforeHide
  ) as z.ZodType<
    StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const createSchema = intrinsicSchema as z.ZodType<z.infer<IntrinsicSchema>>;

  const response = {
    ...pathUtils,
    nonPathKeySchema,
    documentIdentitySchema,
    collectionIdentitySchema,
    collectionKeySchema: pathUtils.collectionPathSchema,
    dataSchema: dataSchemaWithCreateExcluded,
    updateSchema: updateSchemaWithCreateExcluded,
    storeSchema,
    createSchema,
    onInit: config.onInit,
    beforeGenerate: <T>(
      documentIdentity: DocumentIdentity<Path, FieldKeys>,
      inputData: T,
    ) => {
      const afterOnCreate = {
        ...inputData,
        ...(config.onCreate?.(
          documentIdentity,
          inputData as z.infer<IntrinsicSchema>,
        ) ?? {}),
      };
      const afterOnWrite = {
        ...afterOnCreate,
        ...(config.onWrite?.(
          documentIdentity,
          afterOnCreate as Partial<
            StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
          >,
        ) ?? {}),
      };
      const fieldParams = Object.fromEntries(
        fieldKeys.map((key) => [
          key,
          (documentIdentity as Record<string, string>)[key],
        ]),
      ) as Record<string, string>;
      return {
        ...afterOnWrite,
        ...fieldParams,
      } as T &
        Partial<
          StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
        >;
    },
    beforeWrite: <T>(
      documentIdentity: DocumentIdentity<Path, FieldKeys>,
      data: T,
    ) => {
      const afterOnWrite = {
        ...data,
        ...(config.onWrite?.(
          documentIdentity,
          data as Partial<
            StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
          >,
        ) ?? {}),
      };
      const fieldParams = Object.fromEntries(
        fieldKeys.map((key) => [
          key,
          (documentIdentity as Record<string, string>)[key],
        ]),
      ) as Record<string, string>;
      return {
        ...afterOnWrite,
        ...fieldParams,
      } as T &
        Partial<
          StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
        >;
    },
    checkNonPathKeys: (
      data: Record<string, unknown>,
      identityParams:
        | DocumentIdentity<Path, FieldKeys>
        | CollectionIdentity<Path, FieldKeys>,
    ) => {
      return nonPathKeys.every(
        (key) => data[key] === (identityParams as Record<string, string>)[key],
      );
    },
    documentIdentityKeys,
    collectionIdentityKeys,
    fieldKeys,
    nonPathKeys,
  };
  return response;
};

export const collectionConfig = <
  const Path extends string,
  const FieldKeys extends string,
  const IntrinsicSchema extends z.ZodTypeAny,
  const CreateExcludedShape extends z.ZodRawShape = EmptyShape,
  const CreateOmitKeys extends string = never,
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape,
    CreateOmitKeys
  >,
): CollectionConfig<
  Path,
  FieldKeys,
  IntrinsicSchema,
  CreateExcludedShape,
  CreateOmitKeys
> => {
  return {
    ...getCollectionConfigBare(config),
    ...config,
  };
};

type PathKeyShape<Keys extends string> = { [K in Keys]: z.ZodString };

type DataSchemaTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.ZodType<
  DataTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
>;

type UpdateSchemaTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.ZodType<
  UpdateTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
>;

type StoreSchemaTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.ZodType<
  StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
>;

type CreateSchemaTypeFor<IntrinsicSchema extends z.ZodTypeAny> = z.ZodType<
  z.infer<IntrinsicSchema>
>;

export type CollectionConfigMethods<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
  CreateOmitKeys extends string = never,
> = {
  readonly documentPathKeys: readonly DocumentPathKeyFromPath<Path>[];
  readonly documentKey: DocumentKeyFromPath<Path>;
  readonly collectionKeys: readonly CollectionPathKeyFromPath<Path>[];
  readonly collectionPathKeys: readonly CollectionPathKeyFromPath<Path>[];
  readonly documentPathSchema: z.ZodObject<
    PathKeyShape<DocumentPathKeyFromPath<Path>>
  >;
  readonly collectionPathSchema: z.ZodObject<
    PathKeyShape<CollectionPathKeyFromPath<Path>>
  >;
  readonly buildDocumentPath: (
    params: DocumentPathParamsFromPath<Path>,
  ) => string;
  readonly buildCollectionPath: (
    params: CollectionPathParamsFromPath<Path>,
  ) => string;
  readonly parseDocumentPath: (
    path: string,
  ) => DocumentPathParamsFromPath<Path> | null;
  readonly documentKeySchema: z.ZodObject<
    PathKeyShape<DocumentKeyFromPath<Path>>
  >;
  readonly nonPathKeySchema: NonPathKeySchemaFor<Path, FieldKeys>;
  readonly documentIdentitySchema: z.ZodObject<
    PathKeyShape<DocumentIdentityKey<Path, FieldKeys>>
  >;
  readonly collectionIdentitySchema: z.ZodObject<
    PathKeyShape<
      CollectionPathKeyFromPath<Path> | NonPathKeysOf<Path, FieldKeys>
    >
  >;
  readonly collectionKeySchema: z.ZodObject<
    PathKeyShape<CollectionPathKeyFromPath<Path>>
  >;
  readonly dataSchema: DataSchemaTypeFor<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >;
  readonly updateSchema: UpdateSchemaTypeFor<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >;
  readonly storeSchema: StoreSchemaTypeFor<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >;
  readonly createSchema: CreateSchemaTypeFor<IntrinsicSchema>;
  readonly onInit: (() => Partial<z.infer<IntrinsicSchema>>) | undefined;
  readonly beforeGenerate: <T>(
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    inputData: T,
  ) => T &
    Partial<
      StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
    >;
  readonly beforeWrite: <T>(
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    data: T,
  ) => T &
    Partial<
      StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
    >;
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    identityParams:
      | DocumentIdentity<Path, FieldKeys>
      | CollectionIdentity<Path, FieldKeys>,
  ) => boolean;
  readonly documentIdentityKeys: readonly DocumentIdentityKey<
    Path,
    FieldKeys
  >[];
  readonly collectionIdentityKeys: readonly CollectionIdentityKeys<
    Path,
    FieldKeys
  >[];
  readonly fieldKeys: readonly FieldKeys[];
  readonly nonPathKeys: readonly NonPathKeysOf<Path, FieldKeys>[];
  readonly createOmitKeys?: readonly CreateOmitKeys[];
};

export type CollectionConfig<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
  CreateOmitKeys extends string = never,
> = CollectionDefinition<
  Path,
  FieldKeys,
  IntrinsicSchema,
  CreateExcludedShape,
  CreateOmitKeys
> &
  CollectionConfigMethods<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape,
    CreateOmitKeys
  >;

export type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";
