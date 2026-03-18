// Firestore utility exports
export {
  collectionConfig,
  createCollectionQueries,
  createCollectionMutations,
  createCollectionReference,
  resolveScopedQueryOptions,
} from "./firestore";
export type {
  CollectionDefinition,
  CollectionConfig,
  CollectionConfigBase,
  LooseCollectionConfigBase,
  CollectionConfigMethods,
  CollectionQueries,
  CollectionQueriesBase,
  LooseCollectionQueriesBase,
  CollectionMutations,
  CollectionMutationsBase,
  LooseCollectionMutationsBase,
  CollectionReference,
  CollectionFromReference,
  CollectionReferenceBase,
  LooseCollectionReferenceBase,
  // 構成要素の型(CollectionReference関連)
  CollectionReferenceConfig,
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
