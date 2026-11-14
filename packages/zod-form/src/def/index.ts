/* eslint-disable @typescript-eslint/no-explicit-any */
import z from "zod";
import {
  extendArray,
  extendBigint,
  extendBoolean,
  extendEnum,
  extendLiteral,
  extendNumber,
  extendObject,
  extendRecord,
  extendSet,
  extendString,
  extendTuple,
  extendUnion,
  extendCustom,
  getMeta as getZodExtendableMeta,
  MetaOf,
  schemaType,
  type ZodPropagatingRegistryType,
} from "@zodapp/zod-extendable";

import type {
  ExternalKeyConfig,
  RegisteredExternalKeyConfig,
} from "../externalKey/types";
import type { RegisteredValueActionConfig } from "../valueAction/types";
import type { FileConfig, RegisteredFileConfig } from "../file/types";
import type {
  RegisteredResolverContextId,
  RegisteredResolverContextMap,
  RegisteredResolverContext,
} from "../resolverContext/types";

/**
 * zod-form 系で共通に使う schema meta の定義（Zod スキーマ）。
 *
 * `zf.*.registry` で登録するメタのベースとして使われます。
 * React 側（`@zodapp/zod-form-react`）でも参照するため公開しています。
 */
export const zodExtendableCommonDefSchema = z.object({
  label: z.string().optional(),
  uiType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  color: z.string().optional(),
  width: z.number().optional(),
  widthWeight: z.number().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

// object 用メタ
const zodExtendableObjectDefSchema = zodExtendableCommonDefSchema.extend({
  properties: z.array(z.string()).optional(),
});

// date 用メタスキーマ
// 注意: unit/encoding のデフォルト値はスキーマ型によって異なるため、
//       メタスキーマでは省略可能とし、createDateConverter 内で自動推論する
const dateMetaSchema = zodExtendableCommonDefSchema.extend({
  // 粒度（省略時はスキーマから自動推論）
  // - z.date(), z.number(), z.iso.datetime() → second
  // - z.iso.date() → day
  // 注: millisecond は明示的に指定した場合のみ使用（readOnly 表示でミリ秒精度を維持）
  unit: z
    .enum(["year", "month", "day", "minute", "second", "millisecond"])
    .optional(),
  // エンコーディング（省略時はスキーマから自動推論）
  // - timestamp: TZ非依存（Instant）
  // - utcEncode: TZ依存（タイムドリフトでUTCにエンコード）
  // - native: TZ依存（文字列をそのまま保存）
  encoding: z.enum(["timestamp", "utcEncode", "native"]).optional(),
});

/**
 * ComputedValue - React非依存の計算結果型
 * compute 関数の戻り値として使用。UI層（zod-form-mantine 等）が適切にレンダリングする。
 */
export type ComputedValue =
  | string
  | { type: "link"; label: string; href: string }
  | { type: "badge"; label: string; color?: string; value?: string }
  | {
      type: "icon";
      label?: string;
      icon: string;
      color?: string;
      value?: string;
    }
  | {
      type: "title";
      label?: string;
      level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    };

const computedValueSchema = z.custom<ComputedValue>();

export type StringSuggestion = string | { label: string; value: string };

const stringSuggestionSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    value: z.string(),
  }),
]);

/**
 * meta の関数が受け取る入力。
 *
 * - `value`: 自分の値（値を持たない欄では undefined）
 * - `parent`: 親の値。`dependsOnParent: true` のときだけ入る
 * - `context`: resolverContext の一部。`contextId` を指定したときだけ入る
 */
export type FnInput<TValue = unknown, TParent = unknown, TContext = unknown> = {
  value: TValue;
  parent: TParent;
  context: TContext;
};

/**
 * 関数を受け取る meta（computed / dynamic）に共通の指定。
 * 何に反応して関数を呼び直すかを決める。
 */
export type FnSourceMeta = {
  /** 自分の値が変わったら関数を呼び直す。既定 true */
  dependsOnValue?: boolean;
  /** 親の値を購読し、変わったら呼び直す。既定 false */
  dependsOnParent?: boolean;
  /** resolverContext のどの部分を context として渡すか。変わったら呼び直す */
  contextId?: RegisteredResolverContextId;
};

// contextId の値で context の型を絞る
type FnWithContextVariants<
  TKey extends string,
  TValue,
  TParent,
  TResult,
> =
  | ({ contextId?: undefined } & {
      [P in TKey]: (input: FnInput<TValue, TParent, undefined>) => TResult;
    })
  | {
      [K in RegisteredResolverContextId]: { contextId: K } & {
        [P in TKey]: (
          input: FnInput<TValue, TParent, RegisteredResolverContextMap[K]>,
        ) => TResult;
      };
    }[RegisteredResolverContextId];

/**
 * 関数を受け取る meta の型。`dependsOnParent: true` のときだけ `parent` を必須の型にし、
 * `contextId` の値で `context` の型を絞る。
 */
export type FnMeta<TKey extends string, TValue, TParent, TResult> = {
  dependsOnValue?: boolean;
} & (
  | ({ dependsOnParent: true } & FnWithContextVariants<
      TKey,
      TValue,
      TParent,
      TResult
    >)
  | ({ dependsOnParent?: false } & FnWithContextVariants<
      TKey,
      TValue,
      undefined,
      TResult
    >)
);

/**
 * computed の meta。値を持たない欄（z.never）に付ければ表示専用、
 * 値を持つ欄に付ければその値から表示を作る。
 */
export type ComputedMetaDef<
  TResult,
  TValue = any,
  TParent = any,
> = z.infer<typeof zodExtendableCommonDefSchema> &
  FnMeta<"compute", TValue, TParent, TResult>;

/** dynamic の resolve が返す schema と、その schema を見分ける key */
export type ResolvedSchema = {
  schema: z.ZodTypeAny;
  /**
   * schema を見分ける key。key が変わったら別の schema とみなし、
   * 利用者の編集が原因なら値を新しい schema に合わせて削る。
   * key が同じなら描画だけを更新する。
   */
  key: string;
};

/**
 * 何度でも schema を届ける購読。key があれば、同じ key のあいだは購読を張り直さない。
 * 取得に失敗したら fail を呼ぶ。
 */
export type SchemaSubscription = {
  key?: string;
  subscribe: (
    emit: (resolved: ResolvedSchema) => void,
    fail: (error: unknown) => void,
  ) => () => void;
};

/** resolve の戻り値。同期・Promise・購読のどれでもよい */
export type SchemaResolveResult =
  | ResolvedSchema
  | Promise<ResolvedSchema | undefined>
  | SchemaSubscription
  | undefined;

export type SchemaResolver<
  TValue = unknown,
  TParent = unknown,
  TContext = unknown,
> = (input: FnInput<TValue, TParent, TContext>) => SchemaResolveResult;

/**
 * dynamic の meta。resolve は { value, parent, context } を受け取り、
 * 実際に描画・検証する schema を返す。
 */
export type DynamicMetaDef<TValue = any, TParent = any> = z.infer<
  typeof zodExtendableCommonDefSchema
> &
  FnMeta<"resolve", TValue, TParent, SchemaResolveResult>;

export type ExternalKeyMetaDef = z.infer<
  typeof zodExtendableCommonDefSchema
> & {
  externalKeyConfig: ExternalKeyConfig<RegisteredExternalKeyConfig>;
  /** 選んだ値に対する操作（リンクで開くなど） */
  valueAction?: RegisteredValueActionConfig;
};

export type FileMetaDef = z.infer<typeof zodExtendableCommonDefSchema> & {
  fileConfig: FileConfig<RegisteredFileConfig>;
};

export type RegistryValue<TValue> = z.core.$replace<TValue, z.ZodTypeAny>;

export const asRegistryValue = <TValue,>(
  value: TValue,
): RegistryValue<TValue> => value as unknown as RegistryValue<TValue>;

/**
 * resolve 関数を registry に渡せる型にする。Promise や購読を返す resolve は、
 * registry の型変換（schema の置き換え）を通らないため、これで包む。
 */
export const asRegistrySchemaResolver = <
  TValue = any,
  TParent = any,
  TContext = any,
>(
  resolver: SchemaResolver<TValue, TParent, TContext>,
): RegistryValue<SchemaResolver<TValue, TParent, TContext>> =>
  asRegistryValue(resolver);

/**
 * dynamic の meta 全体を registry に渡せる型にする。
 * `dependsOnParent` / `contextId` に合わせて resolve の入力の型が絞られる。
 *
 * @example
 * zf.dynamic().register(zf.dynamic.registry, defineDynamicMeta({
 *   dependsOnParent: true,
 *   resolve: ({ parent }) => ({ schema: buildSchema(parent), key: parent.kind }),
 * }));
 */
export const defineDynamicMeta = <TValue = any, TParent = any>(
  meta: DynamicMetaDef<TValue, TParent>,
): RegistryValue<DynamicMetaDef> =>
  asRegistryValue(meta as DynamicMetaDef);

// 値ごとの操作（選んだ値をリンクで開くなど）。実行時の resolver が解釈するため、core では構造だけ受ける
const valueActionSchema = z.custom<RegisteredValueActionConfig>().optional();

// string 専用メタスキーマ（formatter で表示時の整形を指定可能）
// uiType: "select" を指定すると suggestions から選ぶ形で描画する（検証は string のまま）
const stringMetaSchema = zodExtendableCommonDefSchema.extend({
  formatter: z
    .function({
      input: [z.string()],
      output: computedValueSchema,
    })
    .optional(),
  suggestions: z.array(stringSuggestionSchema).optional(),
  /** 選んだ値に対する操作（リンクで開くなど） */
  valueAction: valueActionSchema,
});

// number 専用メタスキーマ（formatter で表示時の整形を指定可能）
const numberMetaSchema = zodExtendableCommonDefSchema.extend({
  formatter: z
    .function({
      input: [z.number()],
      output: computedValueSchema,
    })
    .optional(),
});

const booleanMetaSchema = zodExtendableCommonDefSchema.extend({
  trueLabel: z.string().optional(),
  falseLabel: z.string().optional(),
});

const common = extendCustom(
  z.never,
  "common",
  zodExtendableCommonDefSchema,
  schemaType<z.ZodType>(),
);

const hidden = extendCustom(
  z.never,
  "hidden",
  zodExtendableCommonDefSchema,
  schemaType<z.ZodType>(),
);

// 外部キー用設定スキーマ
const externalKeyConfigSchema = zodExtendableCommonDefSchema.extend({
  // RegisteredExternalKeyConfig を使用（declare module で拡張可能）
  externalKeyConfig: z.custom<ExternalKeyConfig<RegisteredExternalKeyConfig>>(),
  // 選んだ値に対する操作（リンクで開くなど）
  valueAction: valueActionSchema,
}) as z.ZodType<ExternalKeyMetaDef>;

const externalKey = extendCustom(
  z.string,
  "externalKey",
  externalKeyConfigSchema,
  schemaType<z.ZodString>(),
);

// ファイル設定用メタスキーマ
const fileConfigSchema = zodExtendableCommonDefSchema.extend({
  // RegisteredFileConfig を使用（declare module で拡張可能）
  fileConfig: z.custom<FileConfig<RegisteredFileConfig>>(),
}) as z.ZodType<FileMetaDef>;

const file = extendCustom(
  z.string,
  "file",
  fileConfigSchema,
  schemaType<z.ZodString>(),
);

// zf.date: 複数の Zod 型に対応
// z.date(), z.number(), z.iso.datetime(), z.iso.datetime({ local: true }), z.iso.date()
const date = extendCustom(
  z.date, // ベース型（実際には複数型を受け入れる）
  "date",
  dateMetaSchema,
  schemaType<z.ZodDate | z.ZodNumber | z.ZodISODateTime | z.ZodISODate>(),
);

/**
 * {@link FnSourceMeta} の Zod スキーマ。関数を受け取る meta のメタスキーマに混ぜて使う。
 */
export const fnSourceMetaSchema = z.object({
  dependsOnValue: z.boolean().optional(),
  dependsOnParent: z.boolean().optional(),
  contextId: z.custom<RegisteredResolverContextId>().optional(),
});

// computed: { value, parent, context } を受け取り ComputedValue を返す
// 値を持たない欄（z.never）に付ければ表示専用、値を持つ欄に付ければその値の表示になる
const computed = extendCustom(
  z.never,
  "computed",
  zodExtendableCommonDefSchema.extend({
    ...fnSourceMetaSchema.shape,
    compute: z.function({
      input: [z.any()],
      output: computedValueSchema,
    }),
  }) as unknown as z.ZodType<ComputedMetaDef<ComputedValue>>,
  schemaType<z.ZodType>(),
);

// dynamic: { value, parent, context } から、実際に描画・検証する schema を実行時に決める
const dynamic = extendCustom(
  z.never,
  "dynamic",
  zodExtendableCommonDefSchema.extend({
    ...fnSourceMetaSchema.shape,
    resolve: z.custom<SchemaResolver<any, any, any>>(),
  }) as unknown as z.ZodType<DynamicMetaDef>,
  schemaType<z.ZodType>(),
);

/**
 * zf - React非依存のZodスキーマ拡張
 * computed: { value, parent, context } から表示を作る
 */
const zf = {
  literal: extendLiteral(zodExtendableCommonDefSchema),
  string: extendString(stringMetaSchema),
  number: extendNumber(numberMetaSchema),
  bigint: extendBigint(zodExtendableCommonDefSchema),
  date, // extendCustom パターンに変更
  boolean: extendBoolean(booleanMetaSchema),
  array: extendArray(
    zodExtendableCommonDefSchema.extend({
      discriminator: z.string().optional(),
      displayLength: z.number().optional(),
    }),
  ),
  tuple: extendTuple(zodExtendableCommonDefSchema),
  record: extendRecord(zodExtendableCommonDefSchema),
  set: extendSet(zodExtendableCommonDefSchema),
  enum: extendEnum(
    zodExtendableCommonDefSchema.extend({
      /** 選んだ値に対する操作（リンクで開くなど） */
      valueAction: valueActionSchema,
    }),
  ),
  object: extendObject(zodExtendableObjectDefSchema),
  union: extendUnion(
    zodExtendableCommonDefSchema.extend({
      // union selector は object field ではない独立 UI なので、
      // container 全体の hidden/readOnly とは別に selector 専用 meta で制御する。
      selectorLabel: z.string().optional(),
      unselectedLabel: z.string().optional(),
      hideSelector: z.boolean().optional(),
      readOnlySelector: z.boolean().optional(),
    }),
  ),
  common,
  hidden,
  externalKey,
  file,
  computed,
  dynamic,
};

type ZfRegistryKey = {
  [K in keyof typeof zf]: (typeof zf)[K] extends { registry: any } ? K : never;
}[keyof typeof zf];

type ZfRegistry<TypeName extends ZfRegistryKey> =
  (typeof zf)[TypeName] extends { registry: infer Registry } ? Registry : never;

type ZfMeta<TypeName extends ZfRegistryKey> =
  ZfRegistry<TypeName> extends ZodPropagatingRegistryType<any, any, any>
    ? MetaOf<ZfRegistry<TypeName>>
    : never;

// TypeNameがない場合は、すべての型のUNION
const getMetaByType = <
  S extends z.ZodTypeAny,
  TypeName extends ZfRegistryKey = ZfRegistryKey,
>(
  schema: S,
  _typeName?: TypeName,
): ZfMeta<TypeName> => {
  return getZodExtendableMeta(schema) as ZfMeta<TypeName>;
};

// TypeNameがない場合、schemaのtypeを利用できる場合は利用する
// 利用できない場合は、すべての型のUNIONで返す
/**
 * zod-form のメタデータ（label/uiType/tags 等）を取得します。
 *
 * `schema` の型（`schema.type`）から registry を推定し、該当するメタ型として返します。
 * 型推定が難しい場合は union として返ります（必要なら `_typeName` を明示して絞り込めます）。
 */
export const getMeta = <
  S extends z.ZodTypeAny,
  TypeName extends ZfRegistryKey = S["type"] extends ZfRegistryKey
    ? S["type"]
    : ZfRegistryKey,
>(
  schema: S,
  _typeName?: TypeName,
): ZfMeta<TypeName> => {
  return getMetaByType<S, TypeName>(schema);
};

export { zf };
