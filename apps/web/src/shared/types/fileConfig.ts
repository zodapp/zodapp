/**
 * フォームのデモで使う FileConfig 型定義
 *
 * このファイルは2つの役割を持つ:
 * 1. WebFileConfig 型の定義
 * 2. declare module による型登録（zf.file.registry に型を効かせる）
 *
 * フォームのデモは DB やストレージに依存しないので、Mock の Resolver だけを使う。
 * S3 などの実際の保存先は、各サンプル（apps/taskmanager など）が自分で登録する。
 */
import type { BaseFileConfig } from "@zodapp/zod-form";

/**
 * Mock 用の FileConfig 型（開発・テスト用）
 */
export type MockFileConfig = BaseFileConfig<"mock">;

/**
 * フォームのデモで使用する FileConfig の型
 */
export type WebFileConfig = MockFileConfig;

/**
 * declare module でグローバル型を登録
 * これにより zf.file.registry の fileConfig が
 * WebFileConfig として型推論される
 */
declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: WebFileConfig;
  }
}
