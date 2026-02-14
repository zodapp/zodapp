/**
 * Web アプリ固有の FileConfig 型定義
 *
 * このファイルは2つの役割を持つ:
 * 1. WebFileConfig union 型の定義（案1で satisfies に使用可能）
 * 2. declare module による型登録（案3で zf.file.registry に型を効かせる）
 */
import type { FirebaseStorageFileConfig } from "@zodapp/zod-form-firebase";
import type { BaseFileConfig } from "@zodapp/zod-form";

/**
 * Mock 用の FileConfig 型（開発・テスト用）
 */
export type MockFileConfig = BaseFileConfig<"mock"> & {
  storageLocationId?: string;
};

/**
 * Web アプリで使用する FileConfig の union 型
 * 将来的に他の Resolver（S3 など）を追加する場合はここに追加
 */
export type WebFileConfig = FirebaseStorageFileConfig | MockFileConfig;

/**
 * 案3: declare module でグローバル型を登録
 * これにより zf.file.registry の fileConfig が
 * WebFileConfig として型推論される
 */
declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: WebFileConfig;
  }
}
