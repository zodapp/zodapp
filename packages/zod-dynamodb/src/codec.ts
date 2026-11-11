import {
  $remove,
  postprocess,
  preprocess,
  type PostprocessorDef,
  type PreprocessorDef,
} from "@zodapp/zod-transform";
import type { z } from "zod";

/**
 * ZodのSchemaに沿って、アプリ内の値をDynamoDBに保存できる値に変換する（§5.7）。
 *
 * - `Date` はUTCのISO文字列にする（キーのエンコーディングと同じ表現）
 * - `Set` / `Map` は配列 / オブジェクトにする（空のSetを保存できないため）
 * - `bigint` は文字列にする
 * - `undefined` は取り除く
 *
 * Schemaを手がかりに変換するため、`z.unknown()` などの型を持たない部分には
 * JSONで表せる値だけを入れる。
 */
export const toStorage = (value: unknown, schema: z.core.$ZodType): unknown =>
  postprocess(
    value as never,
    schema as never,
    {
      date: (v: Date) => v.toISOString(),
      set: (v: Set<unknown>) => Array.from(v),
      map: (v: Map<string, unknown>) => Object.fromEntries(v),
      bigint: (v: bigint) => v.toString(),
      undefined: (v: undefined) => (v === undefined ? $remove() : v),
    } as PostprocessorDef,
  );

/**
 * DynamoDBから読み取った値を、Schemaに沿ってアプリ内の値に戻す。検証は行わない。
 */
export const fromStorage = (value: unknown, schema: z.core.$ZodType): unknown =>
  preprocess(
    value,
    schema as never,
    {
      date: (v: unknown) => (typeof v === "string" ? new Date(v) : v),
      set: (v: unknown) => (Array.isArray(v) ? new Set(v) : v),
      map: (v: unknown) =>
        v !== null && typeof v === "object" && !(v instanceof Map)
          ? new Map(Object.entries(v as Record<string, unknown>))
          : v,
      bigint: (v: unknown) =>
        typeof v === "string" || typeof v === "number" ? BigInt(v) : v,
    } as PreprocessorDef,
  );
