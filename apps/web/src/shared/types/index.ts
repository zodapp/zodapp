/**
 * Web アプリ固有の型定義
 *
 * declare module を有効化するため、このファイルを適切なエントリーポイントからインポートする
 */

// declare module を有効にするためにインポート
import "./externalKeyConfig";
import "./fileConfig";

// 必要に応じて re-export
export type { WebExternalKeyConfig } from "./externalKeyConfig";
export type { WebFileConfig } from "./fileConfig";
