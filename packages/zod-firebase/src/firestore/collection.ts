import { hideSchemaFields, type AnyZodObject } from "@zodapp/zod-form";
import {
  CollectionPathKeyFromPath,
  CollectionPathParamsFromPath,
  compilePath,
  DocumentKeyFromPath,
  DocumentPathKeyFromPath,
  DocumentPathParamsFromPath,
} from "./pathUtil";
import {
  assertTopLevelOverlappingKeysOptional,
  mergeSchemaForCollection,
} from "./utils/schemaTransform";
import { z } from "zod";
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
> = {
  path: Path;
  fieldKeys?: readonly FieldKeys[];
  schema: IntrinsicSchema;
  createExcludedSchema?: z.ZodObject<CreateExcludedShape>;
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

type NonPathKeySchemaFor<Path extends string, FieldKeys extends string> = [
  NonPathKeysOf<Path, FieldKeys>,
] extends [never]
  ? z.ZodUnknown
  : z.ZodObject<{ [K in NonPathKeysOf<Path, FieldKeys>]: z.ZodString }>;

type AsIsObjectTypeOf<Shape extends z.ZodRawShape> = [keyof Shape] extends [
  never,
]
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
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.infer<IntrinsicSchema> & AsIsObjectTypeOf<CreateExcludedShape>;

type StoreTypeFor<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.infer<IntrinsicSchema> &
  SafeMappedType<NonPathKeysOf<Path, FieldKeys>, string> &
  AsIsObjectTypeOf<CreateExcludedShape>;

const EMPTY_OBJECT_SCHEMA = z.object({});

export const getCollectionConfigBare = <
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >,
) => {
  const pathUtils = compilePath(config.path);
  const fieldKeys = (config.fieldKeys ?? []) as readonly FieldKeys[];
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

  const effectiveCreateExcludedSchema = (config.createExcludedSchema ??
    EMPTY_OBJECT_SCHEMA) as AnyZodObject;

  const intrinsicSchema = config.schema;
  const fieldKeySchema = z.object(
    Object.fromEntries(fieldKeys.map((key) => [key, z.string()])),
  );

  const createExcludedKeys = Object.keys(effectiveCreateExcludedSchema.shape);

  assertTopLevelOverlappingKeysOptional(
    intrinsicSchema,
    documentIdentityKeys as unknown as string[],
    "identity overlap",
  );
  assertTopLevelOverlappingKeysOptional(
    intrinsicSchema,
    createExcludedKeys,
    "createExcluded overlap",
  );

  const dataSchemaBase = mergeSchemaForCollection(
    mergeSchemaForCollection(
      intrinsicSchema,
      documentIdentitySchema,
      "required",
    ),
    effectiveCreateExcludedSchema,
    "asIs",
  );
  const dataSchema = hideSchemaFields(dataSchemaBase, {
    paths: documentIdentityKeys as unknown as string[],
  }) as z.ZodType<
    DataTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const updateSchemaBase = mergeSchemaForCollection(
    intrinsicSchema,
    effectiveCreateExcludedSchema,
    "asIs",
  );
  const updateSchema = hideSchemaFields(updateSchemaBase, {
    paths: documentIdentityKeys as unknown as string[],
  }) as z.ZodType<UpdateTypeFor<IntrinsicSchema, CreateExcludedShape>>;

  const storeSchemaBase = mergeSchemaForCollection(
    mergeSchemaForCollection(
      intrinsicSchema,
      fieldKeySchema as AnyZodObject,
      "required",
    ),
    effectiveCreateExcludedSchema,
    "asIs",
  );
  const storeSchema = storeSchemaBase as z.ZodType<
    StoreTypeFor<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape>
  >;

  const createHidePaths = [
    ...(documentIdentityKeys as unknown as string[]),
    ...createExcludedKeys,
  ].filter((key, index, arr) => arr.indexOf(key) === index);

  const createSchema = (
    createHidePaths.length > 0
      ? hideSchemaFields(intrinsicSchema, {
          paths: createHidePaths,
        })
      : intrinsicSchema
  ) as z.ZodType<z.infer<IntrinsicSchema>>;

  const response = {
    ...pathUtils,
    nonPathKeySchema,
    documentIdentitySchema,
    collectionIdentitySchema,
    collectionKeySchema: pathUtils.collectionPathSchema,
    dataSchema,
    updateSchema,
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
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >,
): CollectionConfig<Path, FieldKeys, IntrinsicSchema, CreateExcludedShape> => {
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
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape,
> = z.ZodType<UpdateTypeFor<IntrinsicSchema, CreateExcludedShape>>;

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
};

export type CollectionConfig<
  Path extends string,
  FieldKeys extends string,
  IntrinsicSchema extends z.ZodTypeAny,
  CreateExcludedShape extends z.ZodRawShape = EmptyShape,
> = CollectionDefinition<
  Path,
  FieldKeys,
  IntrinsicSchema,
  CreateExcludedShape
> &
  CollectionConfigMethods<
    Path,
    FieldKeys,
    IntrinsicSchema,
    CreateExcludedShape
  >;

export type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";
