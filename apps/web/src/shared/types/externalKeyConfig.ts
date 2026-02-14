/**
 * Web アプリ固有の ExternalKeyConfig 型定義
 *
 * このファイルは2つの役割を持つ:
 * 1. WebExternalKeyConfig union 型の定義（案1で satisfies に使用可能）
 * 2. declare module による型登録（案3で zf.externalKey.registry に型を効かせる）
 */
import type { FirestoreExternalKeyConfig } from "@zodapp/zod-form-firebase";

/**
 * Web アプリで使用する ExternalKeyConfig の union 型
 * 将来的に他の Resolver（REST API など）を追加する場合はここに追加
 */
export type WebExternalKeyConfig = FirestoreExternalKeyConfig;
// | OtherResolverConfig  // 将来の拡張用

/**
 * 案3: declare module でグローバル型を登録
 * これにより zf.externalKey.registry の externalKeyConfig が
 * WebExternalKeyConfig として型推論される
 */
declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: WebExternalKeyConfig;
  }
}
