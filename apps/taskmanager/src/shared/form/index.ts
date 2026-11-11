// declare module を有効にするため、共有の定義から import する
import "./resolverContext";
import "./externalKeyConfig";
import "./fileConfig";

export type { DynamoExternalKeyConfig } from "./externalKeyConfig";
export type { S3FileConfig } from "./fileConfig";
export type {
  AppResolverContextId,
  AppResolverContextMap,
} from "./resolverContext";
