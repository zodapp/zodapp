import type { KeyValue } from "./encoding";

/** 型を展開して読みやすくする */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** いずれかのvariantにあるフィールド名 */
export type AllKeys<T> = T extends unknown ? keyof T & string : never;

/** すべてのvariantに共通するフィールド名 */
export type CommonKeys<T> = keyof T & string;

/** フィールドの型（そのフィールドを持つvariantの型の合併） */
export type FieldType<T, K extends string> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;

/** ベーステーブルのキーにできるフィールド（全variantに共通し、キーにできる型） */
export type BaseKeyField<T> = {
  [K in CommonKeys<T>]: [FieldType<T, K>] extends [KeyValue] ? K : never;
}[CommonKeys<T>];

/** Indexのキーにできるフィールド（いずれかのvariantにあり、キーにできる型） */
export type IndexKeyField<T> = {
  [K in AllKeys<T>]: [Exclude<FieldType<T, K>, undefined>] extends [KeyValue]
    ? K
    : never;
}[AllKeys<T>];

/** 数値のフィールド（`add` の対象） */
export type NumericField<T> = {
  [K in AllKeys<T>]: [Exclude<FieldType<T, K>, undefined>] extends [number]
    ? K
    : never;
}[AllKeys<T>];

/** キーの型：`Pick<z.output<Item>, キーのフィールド>` */
export type KeyOf<T, F extends string> = Simplify<{
  [K in F]: FieldType<T, K>;
}>;

/** 部分更新の型：itemのvariantごとの `Partial`（§6.4） */
export type PatchOf<T> = T extends unknown
  ? { [K in keyof T]?: T[K] | undefined }
  : never;

/** 射影の結果の型：itemのvariantごとの `Pick`（§6.3） */
export type ProjectedOf<T, K> = T extends unknown
  ? Simplify<Pick<T, K & keyof T>>
  : never;

/** variantごとの `Omit` */
export type OmittedOf<T, K> = T extends unknown
  ? Simplify<Omit<T, K & keyof T>>
  : never;

/**
 * Indexに載るvariantだけに絞り、Indexのフィールドから `undefined` を除いた型（§6.3）。
 */
export type IndexedVariant<T, F extends string> = T extends unknown
  ? [F] extends [keyof T]
    ? Simplify<Omit<T, F> & { [K in F & keyof T]-?: Exclude<T[K], undefined> }>
    : never
  : never;

/**
 * 関数の型を、引数について双変にする（メソッドと同じ扱い）。
 * 具体的な引数の型を持つ定義を、`QueryDef` などの既定の型に代入できるようにする
 */
export type Bivariant<F extends (...args: any[]) => any> = {
  bivarianceHack(...args: Parameters<F>): ReturnType<F>;
}["bivarianceHack"];
