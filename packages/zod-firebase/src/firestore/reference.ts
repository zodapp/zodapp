import type {
  CollectionConfigBase,
  LooseCollectionConfigBase,
} from "./baseTypes";

// NOTE: エクスポートされていないと型参照が解決できず、ビルド時に落ちるケースがあるため公開しています。

/**
 * 外部キー用フィールド設定
 */
export type LookupConfig = {
  /** 表示用フィールド名 */
  labelField: string;
  /** 値用フィールド名（パスパラメータから取得されるドキュメントIDキーを指定） */
  valueField: string;
};

export type CollectionReference<
  TCollection extends LooseCollectionConfigBase,
> = {
  readonly collection: TCollection;
  readonly lookupConfig: LookupConfig;
};

export interface CollectionReferenceBase {
  readonly collection: CollectionConfigBase;
  readonly lookupConfig: LookupConfig;
}

export interface LooseCollectionReferenceBase {
  readonly collection: LooseCollectionConfigBase;
  readonly lookupConfig: LookupConfig;
}

export const createCollectionReference = <
  const TCollection extends LooseCollectionConfigBase,
>(
  collection: TCollection,
  lookupConfig: LookupConfig,
): CollectionReference<TCollection> => ({
  collection,
  lookupConfig,
});
