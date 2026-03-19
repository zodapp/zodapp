/**
 * Web アプリ固有の ExternalKeyConfig 型定義
 *
 * このファイルは以下の役割を持つ:
 * 1. WebExternalKeyConfig union 型の定義
 * 2. declare module による型登録（zf.externalKey.registry）
 */
import type { FirestoreExternalKeyConfig } from "@zodapp/zod-form-firebase";
import type {
  WebResolverContextId,
  WebResolverContextMap,
} from "./resolverContext";

type WebFirestoreExternalKeyConfig<K extends WebResolverContextId> =
  FirestoreExternalKeyConfig<"firestore", K, WebResolverContextMap[K]>;

/**
 * Web アプリで使用する ExternalKeyConfig の union 型
 * 将来的に他の Resolver（REST API など）を追加する場合はここに追加
 */
export type WebExternalKeyConfig = {
  [K in WebResolverContextId]: WebFirestoreExternalKeyConfig<K>;
}[WebResolverContextId];

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: WebExternalKeyConfig;
  }
}
