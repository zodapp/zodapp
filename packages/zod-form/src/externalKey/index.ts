/**
 * 外部キー解決のためのエクスポート
 */

export type {
  ResolverId,
  Unsubscriber,
  ExternalKeyOptionsHandler,
  ExternalKeyErrorHandler,
  ExternalKeyResolverResult,
  BaseExternalKeyConfig,
  ExternalKeyResolverEntry,
  ExternalKeyResolvers,
  ExternalKeyConfigRegistry,
  RegisteredExternalKeyConfig,
} from "./types";

export type {
  MockExternalKeyConfig,
  MockExternalKeyOption,
  MockTopic,
} from "./mock";
export { createMockExternalKeyResolver, createMockTopic } from "./mock";
