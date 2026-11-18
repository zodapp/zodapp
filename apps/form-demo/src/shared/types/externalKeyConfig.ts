/**
 * フォームのデモで使う externalKey の config 型の登録
 *
 * フォームのデモは DB に依存しないので、Mock の Resolver だけを使う。
 */
import type { MockExternalKeyConfig } from "@zodapp/zod-form";
import type { WebResolverContextMap } from "./resolverContext";

/**
 * filter の context は、contextId: "team" を書いた欄でだけ届く。
 * 書かない欄では undefined になるので、型にも undefined を含める。
 * `demoDelayMs` はデモの側で包んだ resolver（withDemoDelay）が使う待ち時間。モックは使わない
 */
export type WebExternalKeyConfig = MockExternalKeyConfig<
  "mock",
  WebResolverContextMap["team"] | undefined
> & { demoDelayMs?: number };

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: WebExternalKeyConfig;
  }
}
