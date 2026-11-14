/**
 * フォームのデモで使う externalKey の config 型の登録
 *
 * フォームのデモは DB に依存しないので、Mock の Resolver だけを使う。
 */
import type { MockExternalKeyConfig } from "@zodapp/zod-form";

export type WebExternalKeyConfig = MockExternalKeyConfig;

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: WebExternalKeyConfig;
  }
}
