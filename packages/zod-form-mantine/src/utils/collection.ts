import type { z } from "zod";

/**
 * 複数の値を持つ欄の、値の入れ物（配列か Set）。
 * 複数選択（`multipleEnum`）・タグ入力（`multipleString`）の部品を、配列と Set の両方で使うためのもの。
 * 部品の中では、要素を配列として扱う
 */
export type Collection = {
  /** 要素の schema */
  elementOf: (schema: z.ZodTypeAny) => z.ZodTypeAny;
  /** フォームの値を、要素の配列にする（入れ物でなければ空の配列） */
  toItems: (value: unknown) => unknown[];
  /** 要素の配列を、フォームの値にする */
  fromItems: (items: unknown[]) => unknown;
};

export const arrayCollection: Collection = {
  elementOf: (schema) => (schema as z.ZodArray<z.ZodTypeAny>).element,
  toItems: (value) => (Array.isArray(value) ? value : []),
  fromItems: (items) => items,
};

/** Set：順序は持たない。重複は入らない */
export const setCollection: Collection = {
  elementOf: (schema) =>
    (schema as z.ZodSet<z.ZodTypeAny>).def.valueType as z.ZodTypeAny,
  toItems: (value) => (value instanceof Set ? Array.from(value) : []),
  fromItems: (items) => new Set(items),
};
