/**
 * 外部キー（担当者など）の選択肢を、登録簿の名前付きクエリから引く設定（@zodapp/zod-form-dynamodb）。
 *
 * 設定は共有の定義に置くので、ブラウザの API には依存させず、登録簿のクエリの名前と、
 * パラメーターを作る関数だけを持つ。Resolver（src/web/shared/resolvers）が名前から API を引く。
 */
import type { DynamoExternalKeyConfig as BaseDynamoExternalKeyConfig } from "@zodapp/zod-form-dynamodb";
import type {
  AppResolverContextId,
  AppResolverContextMap,
} from "./resolverContext";

export type DynamoExternalKeyConfig = {
  [K in AppResolverContextId]: BaseDynamoExternalKeyConfig<
    "dynamodb",
    K,
    AppResolverContextMap[K]
  >;
}[AppResolverContextId];

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: DynamoExternalKeyConfig;
  }
}
