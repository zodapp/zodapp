export type {
  DynamoExternalKeyConfig,
  DynamoExternalKeyConfigCore,
  ExternalKeyItem,
} from "./types";
export {
  createDynamoExternalKeyResolver,
  labelOf,
  resolveQuery,
  type DynamoExternalKeyResolverOptions,
  type QueryApi,
} from "./resolver";
