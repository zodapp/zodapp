/**
 * 外部キー解決のためのエクスポート
 */

export type {
  ResolverId,
  Unsubscriber,
  ExternalKeyOptionsHandler,
  ExternalKeyResolverResult,
  BaseExternalKeyConfig,
  ExternalKeyResolverEntry,
  ExternalKeyResolvers,
  ExternalKeyConfigRegistry,
  RegisteredExternalKeyConfig,
} from "./types";

export type { MockExternalKeyConfig, MockExternalKeyOption } from "./mock";
export { createMockExternalKeyResolver } from "./mock";
