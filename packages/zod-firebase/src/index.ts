// Firestore utility exports
export { collectionConfig } from "./firestore";
export type {
  CollectionDefinition,
  CollectionConfig,
  CollectionConfigBase,
  LooseCollectionConfigBase,
  CollectionConfigMethods,
  // 構成要素の型(externalKey関連)
  ExternalKeyConfig,
  // 構成要素の型(QueryOptions関連)
  QueryOptions,
  WhereFilterOp,
  WhereParams,
  OrderByParams,
  // 構成要素の型(Query/Mutation関連)
  MutationFn,
  QueryFn,
  // 開発用-型チェック用 export
  // getCollectionConfigBare,
} from "./firestore";
