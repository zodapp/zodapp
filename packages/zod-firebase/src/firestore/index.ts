import { z } from "zod";
import { zf, getMeta } from "@zodapp/zod-form";

/**
 * Zodスキーマを公開APIのみでcloneする。
 * .describe() は常に新しいインスタンスを返す性質を利用。
 * as stringすることで、in/keysの挙動が変わるが、zodの実装コートでは、in/keysは使ってないので問題ない。
 */
function cloneSchema<T extends z.ZodType>(schema: T): T {
  return schema.describe(schema.description as string);
}

import {
  CollectionPathKeyFromPath,
  CollectionPathParamsFromPath,
  compilePath,
  DocumentKeyFromPath,
  DocumentPathKeyFromPath,
  DocumentPathParamsFromPath,
} from "./pathUtil";

/**
 * CollectionConfig のブランドシンボル
 * collectionConfig() で生成された値であることを型レベルで保証する
 */
declare const CollectionConfigBrand: unique symbol;

/**
 * ブランド付き CollectionConfig の型
 * externalKeyConfig などで collectionConfig() の戻り値のみを受け入れるために使用
 */
export type BrandedCollectionConfig = {
  readonly [CollectionConfigBrand]: true;
};

// NOTE: エクスポートされていないと型参照が解決できず、ビルド時に落ちるケースがあるため公開しています。

/**
 * 外部キー用フィールド設定
 */
export type ExternalKeyConfig = {
  /** 表示用フィールド名 */
  labelField: string;
  /** 値用フィールド名（パスパラメータから取得されるドキュメントIDキーを指定） */
  valueField: string;
};

/**
 * Firestore のクエリ演算子（Firebase に依存しない独自定義）
 */
export type WhereFilterOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "in"
  | "array-contains-any"
  | "not-in";

/**
 * クエリ条件の型定義
 */
export type WhereParams = {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
};

/**
 * orderBy 指定のパラメータ。
 *
 * `QueryOptions.orderBy` で使用します。
 */
export type OrderByParams = {
  field: string;
  direction: "asc" | "desc";
};

/**
 * Firestore クエリ条件のオプション。
 *
 * `where` と `orderBy` を組み合わせてクエリを組み立てます。
 */
export type QueryOptions = {
  where?: WhereParams[];
  orderBy?: OrderByParams[];
};

/**
 * mutation 関数の型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MutationFn<DataSchema extends z.ZodObject<any>> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Partial<z.infer<DataSchema>>;

/**
 * query 関数の型（常に関数）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFn = (...args: any[]) => QueryOptions;

// NonPathKeys: fieldKeys のうち path に含まれないキー
type NonPathKeysOf<Path extends string, FieldKeys extends string> = Exclude<
  FieldKeys,
  DocumentPathKeyFromPath<Path>
>;

// DocumentIdentityKeys の型（documentPathKeys + nonPathKeys）
type DocumentIdentityKey<Path extends string, FieldKeys extends string> =
  | DocumentPathKeyFromPath<Path>
  | NonPathKeysOf<Path, FieldKeys>;

type DocumentIdentity<Path extends string, FieldKeys extends string> = {
  [K in DocumentIdentityKey<Path, FieldKeys>]: string;
};
/** collectionIdentity（collectionPathKeys + nonPathKeys）: コレクションを一意に識別するキー群 */
type CollectionIdentity<
  Path extends string,
  FieldKeys extends string,
> = CollectionPathParamsFromPath<Path> &
  Record<NonPathKeysOf<Path, FieldKeys>, string>;

/**
 * `collectionConfig()` に渡すコレクション定義（入力型）。
 *
 * この定義から、次の派生スキーマ・ヘルパーが生成されます。
 * - `documentIdentitySchema` / `collectionIdentitySchema`
 * - `dataSchema` / `updateSchema` / `storeSchema` / `createSchema`
 *
 * 用語:
 * - **pathKeys**: `path` テンプレート中の `:teamId` のようなプレースホルダ名
 * - **fieldKeys**: Firestore ドキュメントの field として保持する identity keys
 *   - **nonPathKeys**: fieldKeys のうち path に含まれないキー
 *   - **pathFieldKeys**: fieldKeys のうち path に含まれるキー（pathKeys を field にも永続化する用途）
 */
export type CollectionDefinition<
  Path extends string,
  FieldKeys extends string = never,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any> = z.ZodObject<any>,
  Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
    string,
    never
  >,
  Queries extends Record<string, QueryFn> = Record<string, never>,
  CreateOmitKeys extends string = never,
> = {
  /**
   * Firestore のドキュメントパスのテンプレート。
   *
   * 例: `"/teams/:teamId/users/:userId"`
   * - `:teamId`は、documentPathKeys, collectionPathKeysの両方に入ります
   * - `:userId`は、documentPathKeysに入ります。
   */
  path: Path;
  /**
   * Firestore ドキュメントの field として保持する identity keys。
   *
   * - path に含まれないキーは **nonPathKeys** として document/collection の識別に使われます
   *   （`documentIdentitySchema` / `collectionIdentitySchema` に必須で追加）
   * - path に含まれるキーは **pathFieldKeys** として、通常は除外される pathKeys を
   *   ドキュメント field にも永続化します（collectionGroup 検索等で有用）
   * - `storeSchema` / `updateSchema` で必須フィールドとして残ります
   * - `beforeGenerate` / `beforeWrite` 実行時に identityParams から自動注入されます
   */
  fieldKeys?: readonly FieldKeys[];
  /**
   * ベースとなる Zod スキーマ。
   *
   * identity 系キー（pathKeys / fieldKeys）を含めても OK ですが、派生スキーマ生成時に
   * required/optional の調整や除外（storeSchema/createSchema）が行われます。
   */
  schema: IntrinsicSchema;
  /**
   * 外部キー（参照フィールド）を扱うための設定（任意）。
   *
   * - `labelField`: 表示用フィールド名
   * - `valueField`: 値用フィールド名（ドキュメントID等）
   */
  externalKeyConfig?: ExternalKeyConfig;
  /**
   * create 時の入力（createSchema）から除外するキー。
   *
   * 典型例: `createdAt` / `updatedAt` など（`onCreate` / `onWrite` で自動設定するフィールド）
   * - schema に存在しないキーが指定された場合はランタイムチェックで検出されます
   */
  createOmitKeys?: readonly CreateOmitKeys[];
  /**
   * フォーム初期化用のデフォルト値を返すコールバック（任意）。
   *
   * - ユーザーが編集前に上書き可能な初期値として使う想定
   * - ユーティリティとして提供するのみで、zof-firebase-*系では利用していません。
   */
  onInit?: () => Partial<z.infer<IntrinsicSchema>>;
  /**
   * create 時の docId を決定します（任意）。
   *
   * - `string` を返す: その値を docId として使用
   * - `undefined` を返す/未設定: ランダムIDを採用
   */
  onCreateId?: (
    collectionIdentity: CollectionIdentity<Path, FieldKeys>,
    inputData: z.infer<IntrinsicSchema>,
  ) => string | undefined;
  /**
   * create の直前に呼ばれるフック（任意）。
   *
   * - `documentIdentity`（pathKeys + nonPathKeys）と `inputData` を受け取ります
   * - 返した Partial は入力データにマージされます（例: `createdAt` の自動設定）
   */
  onCreate?: (
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    inputData: z.infer<IntrinsicSchema>,
  ) => Partial<z.infer<IntrinsicSchema>> | void;
  /**
   * create/update 共通で呼ばれるフック（任意）。
   *
   * - `documentIdentity` と（書き込み対象の）`data` を受け取ります
   * - 返した Partial はデータにマージされます（例: `updatedAt` の自動設定）
   */
  onWrite?: (
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    data: z.infer<IntrinsicSchema>,
  ) => Partial<z.infer<IntrinsicSchema>> | void;
  /**
   * ドメインミューテーション（書き込み系）定義（任意）。
   *
   * `collectionConfig()` が返す `collection.mutations` として公開されます。
   */
  mutations?: Mutations;
  /**
   * クエリ定義（任意）。
   *
   * `collectionConfig()` が返す `collection.queries` として公開されます。
   */
  queries?: Queries;
};

type CollectionIdentityKeys<Path extends string, FieldKeys extends string> =
  | CollectionPathKeyFromPath<Path>
  | NonPathKeysOf<Path, FieldKeys>;

/**
 * any 型を検出するユーティリティ型
 * any & 1 = any となり、0 extends any は true になることを利用
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * any/never の場合は unknown（intersectionで無視される）を返す安全な Mapped Type
 *
 * - SafeMappedType<never, V> = unknown
 * - SafeMappedType<any, V> = unknown（インデックスシグネチャを避けるため）
 * - SafeMappedType<"foo" | "bar", V> = { foo: V; bar: V }
 *
 * unknown は intersection の identity element（A & unknown = A）なので、
 * {} よりも意図が明確で ESLint の ban-types にも引っかからない
 */
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

/**
 * Zodネイティブメソッド用の型定義
 * .extend() の引数に型アサーションすることで、結果の型が自動推論される
 */
type IdentityKeyShapeRequired<Keys extends string> = SafeMappedType<
  Keys,
  z.ZodString
>;
type IdentityKeyShapeOptional<Keys extends string> = SafeMappedType<
  Keys,
  z.ZodOptional<z.ZodString>
>;

export const getCollectionConfigBare = <
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
  Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
    string,
    never
  >,
  Queries extends Record<string, QueryFn> = Record<string, never>,
  CreateOmitKeys extends string = never,
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    Mutations,
    Queries,
    CreateOmitKeys
  >,
) => {
  const pathUtils = compilePath(config.path);
  const fieldKeys = (config.fieldKeys ?? []) as readonly FieldKeys[];
  const createOmitKeys = (config.createOmitKeys ??
    []) as readonly CreateOmitKeys[];
  const mutations = (config.mutations ?? {}) as Mutations;
  const queries = (config.queries ?? {}) as Queries;

  // fieldKeys を path 由来と non-path に分解（内部用）
  const nonPathKeys = fieldKeys.filter(
    (k) => !(pathUtils.documentPathKeys as readonly string[]).includes(k),
  ) as unknown as readonly NonPathKeysOf<Path, FieldKeys>[];

  // documentIdentityKeys = documentPathKeys + nonPathKeys
  const documentIdentityKeys = [
    ...pathUtils.documentPathKeys,
    ...nonPathKeys,
  ] as readonly DocumentIdentityKey<Path, FieldKeys>[];

  // collectionIdentityKeys = collectionPathKeys + nonPathKeys
  const collectionIdentityKeys = [
    ...pathUtils.collectionPathKeys,
    ...nonPathKeys,
  ] as readonly CollectionIdentityKeys<Path, FieldKeys>[];

  // --- バリデーション ---
  const pathLabel = `(path: "${config.path}")`;
  for (const key of createOmitKeys) {
    if (!(key in config.schema.shape)) {
      throw new Error(
        `[collectionConfig] createOmitKey "${key}" must be a key of schema ${pathLabel}`,
      );
    }
  }

  // --- Identity系スキーマ生成 ---
  // documentPathSchema / collectionPathSchema は pathUtils から利用

  // nonPathKeySchema: nonPathKeys のみ（空の場合は z.unknown）
  const nonPathKeySchema = (
    nonPathKeys.length === 0
      ? z.unknown()
      : z.object(
          Object.fromEntries(
            nonPathKeys.map((key: string) => [key, z.string()]),
          ),
        )
  ) as NonPathKeySchemaFor<Path, FieldKeys>;

  // collectionIdentitySchema: collectionPath + nonPathKeys（collection を一意に識別）
  const collectionIdentitySchema = (
    nonPathKeys.length > 0
      ? pathUtils.collectionPathSchema.merge(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nonPathKeySchema as z.ZodObject<any>,
        )
      : pathUtils.collectionPathSchema
  ) as z.ZodObject<{
    [K in
      | CollectionPathKeyFromPath<Path>
      | NonPathKeysOf<Path, FieldKeys>]: z.ZodString;
  }>;

  // documentIdentitySchema: documentPathKeys + nonPathKeys（doc を一意に識別）
  const documentIdentitySchema = z.object(
    Object.fromEntries(
      documentIdentityKeys.map((key: string) => [key, z.string()]),
    ),
  ) as z.ZodObject<{
    [K in DocumentIdentityKey<Path, FieldKeys>]: z.ZodString;
  }>;

  // --- 派生スキーマ生成 ---
  const intrinsicSchema = config.schema;

  // 派生スキーマの Shape 型定義
  // Zodネイティブの .extend() を使うことで、z.infer が正しく型推論される
  // NOTE:
  // intrinsicSchema が identityKeys（例: userId/teamId）を含む場合、
  // `IntrinsicSchema["shape"] & IdentityKeyShapeOptional<...>` は
  // `ZodString & ZodOptional<ZodString>` のような衝突を起こし、z.infer が崩れることがある。
  // そこで documentIdentityKeys を一旦 Omit してから上書きすることで、extend の実態と型を一致させる。
  type AllIdentityKeys = DocumentIdentityKey<Path, FieldKeys>;
  type DataSchemaShape = Omit<IntrinsicSchema["shape"], AllIdentityKeys> &
    IdentityKeyShapeRequired<AllIdentityKeys>;
  // UpdateSchemaShape: documentIdentityKeys は optional だが、fieldKeys は必須（データとして保持されるため）
  type UpdateSchemaShape = Omit<IntrinsicSchema["shape"], AllIdentityKeys> &
    IdentityKeyShapeOptional<Exclude<AllIdentityKeys, FieldKeys>> &
    SafeMappedType<FieldKeys, z.ZodString>;
  // StoreSchemaShape: documentPathKeys を除外し、fieldKeys は必須で残す
  type StoreSchemaShape = Omit<
    IntrinsicSchema["shape"],
    DocumentPathKeyFromPath<Path>
  > &
    SafeMappedType<FieldKeys, z.ZodString>;
  // CreateSchemaShape: documentIdentityKeys と createOmitKeys を除外（fieldKeys は注入されるので原則含めない）
  type CreateSchemaShape = Omit<
    IntrinsicSchema["shape"],
    AllIdentityKeys | CreateOmitKeys
  >;

  // --- ヘルパー関数 ---

  /** shape から指定キーを除外した新しいオブジェクトを返す */
  const removeKeysFromShape = (
    shape: Record<string, z.ZodType>,
    keys: readonly string[],
  ): Record<string, z.ZodType> => {
    const keysSet = new Set(keys);
    return Object.fromEntries(
      Object.entries(shape).filter(([k]) => !keysSet.has(k)),
    );
  };

  /**
   * shape[key] を required 化して返す。
   * optional なら unwrap→clone し、optional 側の label メタを保持する。
   * shape になければ intrinsicSchema.shape をフォールバック参照する。
   * どちらにもなければ z.string() を hidden として返す。
   */
  const getRequiredField = (
    shape: Record<string, z.ZodType>,
    key: string,
  ): z.ZodType => {
    const schema = shape[key] ?? intrinsicSchema.shape[key];
    if (!schema) return z.string().register(zf.hidden.registry, {});

    if (!(schema instanceof z.ZodOptional)) return schema;

    // optional を unwrap し、label メタを保持して clone
    const inner = schema.unwrap() as z.ZodType;
    const optionalLabel = getMeta(schema as z.ZodTypeAny)?.label;
    const cloned = cloneSchema(inner);
    if (optionalLabel) {
      const innerMeta = getMeta(inner as z.ZodTypeAny);
      cloned.register(zf.hidden.registry, {
        ...(innerMeta ?? {}),
        label: optionalLabel,
      });
    }
    return cloned;
  };

  /**
   * shape[key] を optional 化して返す。
   * optional 化すると registry メタが失われるため、label を付け直す。
   * shape になければ intrinsicSchema.shape をフォールバック参照する。
   * どちらにもなければ z.string().optional() を hidden として返す。
   */
  const getOptionalField = (
    shape: Record<string, z.ZodType>,
    key: string,
  ): z.ZodType => {
    const schema = shape[key] ?? intrinsicSchema.shape[key];
    if (!schema) return z.string().optional().register(zf.hidden.registry, {});

    if (schema instanceof z.ZodOptional) return schema;

    const label = getMeta(schema as z.ZodTypeAny)?.label;
    const optional = schema.optional();
    if (label) {
      optional.register(zf.hidden.registry, { label });
    }
    return optional;
  };

  /** shape にキーを required で追加/上書き */
  const addKeysRequired = (
    shape: Record<string, z.ZodType>,
    keys: readonly string[],
  ): Record<string, z.ZodType> => ({
    ...shape,
    ...Object.fromEntries(keys.map((k) => [k, getRequiredField(shape, k)])),
  });

  /** shape にキーを optional で追加/上書き */
  const addKeysOptional = (
    shape: Record<string, z.ZodType>,
    keys: readonly string[],
  ): Record<string, z.ZodType> => ({
    ...shape,
    ...Object.fromEntries(keys.map((k) => [k, getOptionalField(shape, k)])),
  });

  // --- 派生スキーマ生成 ---

  // dataSchema: intrinsicSchema に全 documentIdentityKeys を required で追加
  const dataSchema = z.object(
    addKeysRequired(intrinsicSchema.shape, documentIdentityKeys),
  ) as z.ZodObject<DataSchemaShape>;

  // updateSchema: intrinsicSchema の全 documentIdentityKeys を optional にし、fieldKeys だけ required に戻す
  const updateSchema = z.object(
    addKeysRequired(
      addKeysOptional(intrinsicSchema.shape, documentIdentityKeys),
      fieldKeys,
    ),
  ) as z.ZodObject<UpdateSchemaShape>;

  // storeSchema: intrinsicSchema から documentPathKeys を除去し、fieldKeys を required で追加
  const storeSchema = z.object(
    addKeysRequired(
      removeKeysFromShape(intrinsicSchema.shape, pathUtils.documentPathKeys),
      fieldKeys,
    ),
  ) as z.ZodObject<StoreSchemaShape>;

  // createSchema: intrinsicSchema から documentIdentityKeys と createOmitKeys を除去
  const createSchema = z.object(
    removeKeysFromShape(intrinsicSchema.shape, [
      ...documentIdentityKeys,
      ...createOmitKeys,
    ]),
  ) as z.ZodObject<CreateSchemaShape>;

  // --- 型定義 ---
  type CollectionIdentityParams = CollectionPathParamsFromPath<Path> & {
    [K in NonPathKeysOf<Path, FieldKeys>]: string;
  };

  const response = {
    ...pathUtils,
    // --- Identity系スキーマ ---
    nonPathKeySchema,
    documentIdentitySchema,
    collectionIdentitySchema,
    collectionKeySchema: pathUtils.collectionPathSchema,

    // --- 派生スキーマ ---
    dataSchema,
    updateSchema,
    storeSchema,
    createSchema,

    // --- onInit（フォーム用、accessorでは使わない） ---
    onInit: config.onInit,

    // 新規作成前の処理（onCreate -> onWrite の順で適用し、fieldKeys を注入）。documentIdentity と inputData を渡す。
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
          afterOnCreate as z.infer<IntrinsicSchema>,
        ) ?? {}),
      };
      // fieldKeys を documentIdentity から注入
      const fieldParams = Object.fromEntries(
        fieldKeys.map((key) => [
          key,
          (documentIdentity as Record<string, string>)[key],
        ]),
      ) as Record<string, string>;
      return {
        ...afterOnWrite,
        ...fieldParams,
      } as T & Partial<z.infer<IntrinsicSchema>>;
    },
    // 書き込み前の処理（onWrite のみ適用し、fieldKeys を注入）。documentIdentity と data を渡す。
    beforeWrite: <T>(
      documentIdentity: DocumentIdentity<Path, FieldKeys>,
      data: T,
    ) => {
      const afterOnWrite = {
        ...data,
        ...(config.onWrite?.(
          documentIdentity,
          data as z.infer<IntrinsicSchema>,
        ) ?? {}),
      };
      // fieldKeys を documentIdentity から注入
      const fieldParams = Object.fromEntries(
        fieldKeys.map((key) => [
          key,
          (documentIdentity as Record<string, string>)[key],
        ]),
      ) as Record<string, string>;
      return {
        ...afterOnWrite,
        ...fieldParams,
      } as T & Partial<z.infer<IntrinsicSchema>>;
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

    // documentIdentityKeys = documentPathKeys + nonPathKeys
    documentIdentityKeys,
    // collectionIdentityKeys = collectionPathKeys + nonPathKeys
    collectionIdentityKeys,
    fieldKeys,
    mutations,
    queries,
  };
  return response;
};

/**
 * コレクション定義から、ブランド付きの `CollectionConfig` を生成します。
 *
 * `path` / `schema` / hooks などの入力定義を元に、identity スキーマや path ユーティリティ等の派生情報を付与します。
 */
export const collectionConfig = <
  const Path extends string,
  const FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IntrinsicSchema extends z.ZodObject<any>,
  const Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
    string,
    never
  >,
  const Queries extends Record<string, QueryFn> = Record<string, never>,
  const CreateOmitKeys extends string = never,
>(
  config: CollectionDefinition<
    Path,
    FieldKeys,
    IntrinsicSchema,
    Mutations,
    Queries,
    CreateOmitKeys
  >,
): CollectionConfig<
  Path,
  FieldKeys,
  IntrinsicSchema,
  Mutations,
  Queries,
  CreateOmitKeys
> => {
  return {
    ...getCollectionConfigBare(config),
    ...config,
  };
};

type PathKeyShape<Keys extends string> = { [K in Keys]: z.ZodString };

type DataSchemaShapeFor<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
> = Omit<IntrinsicSchema["shape"], DocumentIdentityKey<Path, FieldKeys>> &
  IdentityKeyShapeRequired<DocumentIdentityKey<Path, FieldKeys>>;

type UpdateSchemaShapeFor<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
> = Omit<IntrinsicSchema["shape"], DocumentIdentityKey<Path, FieldKeys>> &
  IdentityKeyShapeOptional<
    Exclude<DocumentIdentityKey<Path, FieldKeys>, FieldKeys>
  > &
  SafeMappedType<FieldKeys, z.ZodString>;

type StoreSchemaShapeFor<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
> = Omit<IntrinsicSchema["shape"], DocumentPathKeyFromPath<Path>> &
  SafeMappedType<FieldKeys, z.ZodString>;

type CreateSchemaShapeFor<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
  CreateOmitKeys extends string,
> = Omit<
  IntrinsicSchema["shape"],
  DocumentIdentityKey<Path, FieldKeys> | CreateOmitKeys
>;

type IdentityParamsFor<Path extends string, FieldKeys extends string> =
  | DocumentIdentity<Path, FieldKeys>
  | CollectionIdentity<Path, FieldKeys>;

/**
 * `collectionConfig()` が返すオブジェクトに付与されるメソッド/派生スキーマ群。
 *
 * パス生成・パース、identity 検証スキーマ、Firestore 書き込み前の前処理など、
 * コレクション定義から自動生成できるユーティリティをまとめた型です。
 */
export type CollectionConfigMethods<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
  Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
    string,
    never
  >,
  Queries extends Record<string, QueryFn> = Record<string, never>,
  CreateOmitKeys extends string = never,
> = {
  /** パスから抽出した全キー（collectionKeys + documentKey）。 */
  readonly documentPathKeys: readonly DocumentPathKeyFromPath<Path>[];
  /** 最後のパスキー（docKey）。 */
  readonly documentKey: DocumentKeyFromPath<Path>;
  /** documentKey を除いた pathKeys（collectionKeys）。 */
  readonly collectionKeys: readonly CollectionPathKeyFromPath<Path>[];
  /** `collectionKeys` と同義の別名。 */
  readonly collectionPathKeys: readonly CollectionPathKeyFromPath<Path>[];
  /**
   * documentPathKeys（collectionKeys + documentKey）を検証する Zod スキーマ。
   * 用途: `parseDocumentPath()` の戻り値検証や、パスパラメータの型導出。
   */
  readonly documentPathSchema: z.ZodObject<
    PathKeyShape<DocumentPathKeyFromPath<Path>>
  >;
  /**
   * collectionKeys（documentKey を除いた pathKeys）を検証する Zod スキーマ。
   * 用途: `buildCollectionPath()` 引数の型導出や、collection 単位の識別に利用。
   */
  readonly collectionPathSchema: z.ZodObject<
    PathKeyShape<CollectionPathKeyFromPath<Path>>
  >;
  /**
   * ドキュメントパスを組み立てる。
   * 先頭の `/` 有無はどちらでも動作。
   */
  readonly buildDocumentPath: (
    params: DocumentPathParamsFromPath<Path>,
  ) => string;
  /**
   * コレクションパスを組み立てる。
   * 先頭の `/` 有無はどちらでも動作。
   */
  readonly buildCollectionPath: (
    params: CollectionPathParamsFromPath<Path>,
  ) => string;
  /**
   * ドキュメントパスをパースしてパラメータを返す。
   * 不一致の場合は `null`。
   */
  readonly parseDocumentPath: (
    path: string,
  ) => DocumentPathParamsFromPath<Path> | null;

  /**
   * documentKey（最後のパスキー）**だけ**を検証する Zod スキーマ。
   * documentPathSchema との違い: pathKeys 全体ではなく、docKey 単体に限定。
   * 用途: docKey のみを扱う UI/バリデーションや、外部キーの valueField など。
   */
  readonly documentKeySchema: z.ZodObject<
    PathKeyShape<DocumentKeyFromPath<Path>>
  >;
  /** nonPathKeys のみを検証する Zod スキーマ（空なら `z.unknown()`）。 */
  readonly nonPathKeySchema: NonPathKeySchemaFor<Path, FieldKeys>;
  /** documentPathKeys + nonPathKeys を検証する Zod スキーマ。 */
  readonly documentIdentitySchema: z.ZodObject<
    PathKeyShape<DocumentIdentityKey<Path, FieldKeys>>
  >;
  /** collectionKeys + nonPathKeys を検証する Zod スキーマ。 */
  readonly collectionIdentitySchema: z.ZodObject<
    PathKeyShape<
      CollectionPathKeyFromPath<Path> | NonPathKeysOf<Path, FieldKeys>
    >
  >;
  /**
   * collectionKeys を検証する Zod スキーマ（collectionPathSchema の別名）。
   * 用途: collectionPathSchema と同じ（別名として提供）。
   */
  readonly collectionKeySchema: z.ZodObject<
    PathKeyShape<CollectionPathKeyFromPath<Path>>
  >;

  /** `schema` + documentIdentityKeys（必須）で構成される読み取り用スキーマ。 */
  readonly dataSchema: z.ZodObject<
    DataSchemaShapeFor<Path, FieldKeys, IntrinsicSchema>
  >;
  /** 更新用スキーマ（fieldKeys は必須、その他の documentIdentityKeys は optional）。 */
  readonly updateSchema: z.ZodObject<
    UpdateSchemaShapeFor<Path, FieldKeys, IntrinsicSchema>
  >;
  /** Firestore に保存する形のスキーマ（documentPathKeys を除外、fieldKeys は必須）。 */
  readonly storeSchema: z.ZodObject<
    StoreSchemaShapeFor<Path, FieldKeys, IntrinsicSchema>
  >;
  /** 新規作成用スキーマ（documentIdentityKeys と createOmitKeys を除外）。 */
  readonly createSchema: z.ZodObject<
    CreateSchemaShapeFor<Path, FieldKeys, IntrinsicSchema, CreateOmitKeys>
  >;

  /**
   * フォーム初期化用のデフォルト値。
   * フォーム用途のみ（Firestore accessor では使用されない）。
   */
  readonly onInit: (() => Partial<z.infer<IntrinsicSchema>>) | undefined;
  /**
   * create 直前の前処理（`onCreate` → `onWrite` → fieldKeys 注入）。
   */
  readonly beforeGenerate: <T>(
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    inputData: T,
  ) => T & Partial<z.infer<IntrinsicSchema>>;
  /**
   * update 直前の前処理（`onWrite` → fieldKeys 注入）。
   */
  readonly beforeWrite: <T>(
    documentIdentity: DocumentIdentity<Path, FieldKeys>,
    data: T,
  ) => T & Partial<z.infer<IntrinsicSchema>>;
  /**
   * data 内の nonPathKeys が identityParams と一致するか検証。
   */
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    identityParams:
      | DocumentIdentity<Path, FieldKeys>
      | CollectionIdentity<Path, FieldKeys>,
  ) => boolean;

  /** documentPathKeys + nonPathKeys の一覧（ドキュメント識別キーの完全セット）。 */
  readonly documentIdentityKeys: readonly DocumentIdentityKey<
    Path,
    FieldKeys
  >[];
  /** collectionPathKeys + nonPathKeys の一覧（コレクション識別キーの完全セット）。 */
  readonly collectionIdentityKeys: readonly CollectionIdentityKeys<
    Path,
    FieldKeys
  >[];
  /** 入力された fieldKeys（doc field として保持する keys）。 */
  readonly fieldKeys: readonly FieldKeys[];
  /** 入力された mutations（未設定時は `{}`）。 */
  readonly mutations: Mutations;
  /** 入力された queries（未設定時は `{}`）。 */
  readonly queries: Queries;
};

/**
 * `collectionConfig()` が返す、ブランド付きのコレクション設定型。
 *
 * 入力の `CollectionDefinition` と、そこから生成される `CollectionConfigMethods` を合成した型です。
 * 実体は `collectionConfig()` の戻り値のみが満たすことを意図しています。
 */
export type CollectionConfig<
  Path extends string,
  FieldKeys extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IntrinsicSchema extends z.ZodObject<any>,
  Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
    string,
    never
  >,
  Queries extends Record<string, QueryFn> = Record<string, never>,
  CreateOmitKeys extends string = never,
> = CollectionDefinition<
  Path,
  FieldKeys,
  IntrinsicSchema,
  Mutations,
  Queries,
  CreateOmitKeys
> &
  CollectionConfigMethods<
    Path,
    FieldKeys,
    IntrinsicSchema,
    Mutations,
    Queries,
    CreateOmitKeys
  >;

/**
 * `collectionConfig()` の戻り値として扱える最低限の構造を表す base interface。
 *
 * zod-firebase(-browser/node) の各種ユーティリティが「具体的な generics を知らなくても」
 * collectionConfig 生成物として扱うための共通インターフェースです。
 */
export interface CollectionConfigBase {
  // スキーマ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dataSchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly storeSchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly updateSchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly createSchema: z.ZodObject<any>;

  // Identity スキーマ（単体 / path / identity）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentKeySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly nonPathKeySchema: z.ZodObject<any> | z.ZodUnknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentIdentitySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionIdentitySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionKeySchema: z.ZodType<any>;

  // pathUtils から引き継ぐプロパティ
  readonly path: string;
  readonly documentPathKeys: readonly string[];
  readonly collectionKeys: readonly string[];
  readonly documentKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentPathSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionPathSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildDocumentPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildCollectionPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parseDocumentPath: (path: string) => any;

  // メタ情報
  readonly fieldKeys: readonly string[];
  readonly documentIdentityKeys: readonly string[];
  readonly collectionIdentityKeys: readonly string[];

  // ライフサイクル関数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onInit?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeGenerate: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeWrite: (documentIdentity: any, data: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    identityParams: any,
  ) => boolean;

  // CollectionDefinition から引き継ぐプロパティ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly schema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly mutations: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly queries: Record<string, any>;
  readonly createOmitKeys?: readonly string[];
  readonly externalKeyConfig?: ExternalKeyConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreateId?: (
    collectionIdentity: any,
    inputData: any,
  ) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreate?: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onWrite?: (documentIdentity: any, data: any) => any;
}

/**
 * `CollectionConfigBase` の緩い版。
 *
 * 主に型ユーティリティ/境界で「最小限の構造だけを要求したい」場合に使います。
 * `any` を許容するため、アプリ側での直接利用は推奨しません。
 */
export interface LooseCollectionConfigBase {
  // スキーマ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dataSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly storeSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly updateSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly createSchema: any;

  // Identity スキーマ（単体 / path / identity）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentKeySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly nonPathKeySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentIdentitySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionIdentitySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionKeySchema: any;

  // pathUtils から引き継ぐプロパティ
  readonly path: string;
  readonly documentPathKeys: readonly string[];
  readonly collectionKeys: readonly string[];
  readonly documentKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentPathSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionPathSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildDocumentPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildCollectionPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parseDocumentPath: (path: string) => any;

  // メタ情報
  readonly fieldKeys: readonly string[];
  readonly documentIdentityKeys: readonly string[];
  readonly collectionIdentityKeys: readonly string[];

  // ライフサイクル関数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onInit?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeGenerate: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeWrite: (documentIdentity: any, data: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    identityParams: any,
  ) => boolean;

  // CollectionDefinition から引き継ぐプロパティ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly schema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly mutations: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly queries: Record<string, any>;
  readonly createOmitKeys?: readonly string[];
  readonly externalKeyConfig?: ExternalKeyConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreateId?: (
    collectionIdentity: any,
    inputData: any,
  ) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreate?: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onWrite?: (documentIdentity: any, data: any) => any;
}
