/**
 * ResolverContext の型テスト（base package）
 *
 * packages/zod-form 単体では ResolverContextRegistry は空であり、
 * RegisteredResolverContextMap は Record<string, Record<string, unknown>> にフォールバックする。
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  ResolverContextRegistry,
  RegisteredResolverContextMap,
  RegisteredResolverContextId,
  RegisteredResolverContext,
} from "../resolverContext/types";

describe("ResolverContext 型テスト（base package）", () => {
  describe("ResolverContextRegistry の初期状態", () => {
    it("ResolverContextRegistry は初期状態では空オブジェクト型", () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      expectTypeOf<ResolverContextRegistry>().toEqualTypeOf<{}>();
    });

    it("RegisteredResolverContextMap は未拡張時 Record<string, Record<string, unknown>> にフォールバック", () => {
      expectTypeOf<RegisteredResolverContextMap>().toEqualTypeOf<
        Record<string, Record<string, unknown>>
      >();
    });

    it("RegisteredResolverContextId は未拡張時 string にフォールバック", () => {
      expectTypeOf<RegisteredResolverContextId>().toEqualTypeOf<string>();
    });

    it("RegisteredResolverContext は未拡張時 Partial<Record<string, Record<string, unknown>>>", () => {
      expectTypeOf<RegisteredResolverContext>().toEqualTypeOf<
        Partial<Record<string, Record<string, unknown>>>
      >();
    });
  });
});
