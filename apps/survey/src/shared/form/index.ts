// declare module を有効にするため、共有の定義から import する
import "./resolverContext";
import "./externalKeyConfig";

export type { DynamoExternalKeyConfig } from "./externalKeyConfig";
export type {
  AppResolverContextId,
  AppResolverContextMap,
} from "./resolverContext";
