import { z } from "zod";
import { SEPARATOR, encoderFor } from "./encoding";

/**
 * 動的なフィルターの対応（§6.6）。フィルターの属性名から、連結するフィールドの並び。
 * フィールドは名前（文字列のSchemaとして扱う）か、名前とSchemaの組で指定する。
 */
export type FilterSpec = Readonly<
  Record<
    string,
    readonly (string | { readonly field: string; readonly schema: z.ZodType })[]
  >
>;

/**
 * ベクトル検索の実行時の設定。`HASH` の範囲ごとに不変とする（§6.6）。
 */
export type VectorRuntimeConfig = {
  /** 使うベクトルスロット */
  readonly slot: string;
  /** 動的なフィルターの対応 */
  readonly filters?: FilterSpec;
  /** embeddingモデルなど、アプリケーションが使う値 */
  readonly [extra: string]: unknown;
};

/**
 * フィルターの属性の値を組み立てる。書き込み時と検索時の両方で、同じ設定から値を作る。
 * 構成するフィールドが一つでも `undefined` なら、その属性は書かない（検索では絞り込まない）。
 */
export const buildFilters = (
  spec: FilterSpec | undefined,
  values: Readonly<Record<string, unknown>>,
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [attr, fields] of Object.entries(spec ?? {})) {
    const parts: string[] = [];
    let complete = true;
    for (const entry of fields) {
      const field = typeof entry === "string" ? entry : entry.field;
      const schema = typeof entry === "string" ? z.string() : entry.schema;
      const value = values[field];
      if (value === undefined) {
        complete = false;
        break;
      }
      parts.push(
        encoderFor(schema, field, { allowOptional: true }).encode(
          z.parse(schema, value),
        ),
      );
    }
    if (complete && parts.length > 0) out[attr] = parts.join(SEPARATOR);
  }
  return out;
};
