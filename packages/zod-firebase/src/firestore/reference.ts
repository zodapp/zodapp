import type { z } from "zod";
import type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";

// NOTE: エクスポートされていないと型参照が解決できず、ビルド時に落ちるケースがあるため公開しています。

/**
 * 外部キー用フィールド設定
 *
 * @typeParam T - コレクションのデータ型。labelField / valueField のキーを型安全に制約する。
 */
export type CollectionReferenceConfig<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  /** 表示用ラベルのフィールド名。省略時は valueField（または documentKey）の値が使われる */
  labelField?: keyof T & string;
  /** 表示用ラベルを動的に生成する関数。labelField より優先される */
  labelFormatter?: (data: T) => string;
  /** 値用フィールド名。省略時は collection の documentKey にフォールバックする */
  valueField?: keyof T & string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataOfCollection<TCollection extends LooseCollectionConfigBase> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TCollection["dataSchema"] extends z.ZodType<infer D, any>
    ? D extends Record<string, unknown>
      ? D
      : Record<string, unknown>
    : Record<string, unknown>;

export type CollectionReference<
  TCollection extends LooseCollectionConfigBase,
> = {
  readonly collection: TCollection;
  readonly config: CollectionReferenceConfig<DataOfCollection<TCollection>>;
};

export interface CollectionReferenceBase {
  readonly collection: CollectionConfigBase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly config: CollectionReferenceConfig<any>;
}

export interface LooseCollectionReferenceBase {
  readonly collection: LooseCollectionConfigBase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly config: CollectionReferenceConfig<any>;
}

/**
 * CollectionReference から元の collection 型を取り出す
 */
export type CollectionFromReference<
  TReference extends LooseCollectionReferenceBase,
> = TReference extends CollectionReference<infer TCollection>
  ? TCollection
  : TReference["collection"];

export const createCollectionReference = <
  const TCollection extends LooseCollectionConfigBase,
>(
  collection: TCollection,
  config: CollectionReferenceConfig<DataOfCollection<TCollection>>,
): CollectionReference<TCollection> => ({
  collection,
  config,
});
