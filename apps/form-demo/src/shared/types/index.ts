/**
 * Web アプリ固有の型定義
 *
 * declare module を有効化するため、このファイルを適切なエントリーポイントからインポートする
 */

// declare module を有効にするためにインポート
import "./resolverContext";
import "./fileConfig";
import "./externalKeyConfig";
import "./valueAction";

export type { WebFileConfig } from "./fileConfig";
export type { WebExternalKeyConfig } from "./externalKeyConfig";
export type { WebValueActionConfig, WebValueActionParams } from "./valueAction";
export type {
  WebResolverContextId,
  WebResolverContextMap,
} from "./resolverContext";
