/* eslint-disable @typescript-eslint/no-explicit-any */
import z from "zod";
import {
  extendArray,
  extendBigint,
  extendBoolean,
  extendDate,
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
} from "@zodapp/zod-extendable";

import type {
  ExternalKeyConfig,
  RegisteredExternalKeyConfig,
} from "../externalKey/types";
import type { FileConfig, RegisteredFileConfig } from "../file/types";

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
});

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
});

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
 * zf - React非依存のZodスキーマ拡張
 * 注意: message, computed は @zodapp/zod-form-react の zfReact に移動
 */
const zf = {
  literal: extendLiteral(zodExtendableCommonDefSchema),
  string: extendString(zodExtendableCommonDefSchema),
  number: extendNumber(zodExtendableCommonDefSchema),
  bigint: extendBigint(zodExtendableCommonDefSchema),
  date, // extendCustom パターンに変更
  boolean: extendBoolean(zodExtendableCommonDefSchema),
  array: extendArray(
    zodExtendableCommonDefSchema.extend({
      discriminator: z.string().optional(),
    }),
  ),
  tuple: extendTuple(zodExtendableCommonDefSchema),
  record: extendRecord(zodExtendableCommonDefSchema),
  set: extendSet(zodExtendableCommonDefSchema),
  enum: extendEnum(zodExtendableCommonDefSchema),
  object: extendObject(zodExtendableObjectDefSchema),
  union: extendUnion(
    zodExtendableCommonDefSchema.extend({
      selectorLabel: z.string().optional(),
      unselectedLabel: z.string().optional(),
    }),
  ),
  common,
  hidden,
  externalKey,
  file,
};

type ZfRegistryKey = {
  [K in keyof typeof zf]: (typeof zf)[K] extends { registry: any } ? K : never;
}[keyof typeof zf];

// TypeNameがない場合は、すべての型のUNION
const getMetaByType = <
  S extends z.ZodTypeAny,
  TypeName extends ZfRegistryKey = ZfRegistryKey,
>(
  schema: S,
  _typeName?: TypeName,
) => {
  return getZodExtendableMeta(schema) as MetaOf<
    (typeof zf)[TypeName]["registry"]
  >;
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
) => {
  return getMetaByType<S, TypeName>(schema);
};

export { zf };
