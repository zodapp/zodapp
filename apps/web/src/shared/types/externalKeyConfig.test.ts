/**
 * externalKeyConfig.ts の型テスト
 *
 * declare module による型拡張が正しく機能しているかを検証する
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "@zodapp/zod-form";
import type { RegisteredExternalKeyConfig } from "@zodapp/zod-form/externalKey/types";
import type {
  RegisteredResolverContextMap,
  ResolverContextRegistry,
} from "@zodapp/zod-form/resolverContext/types";

// declare module による型拡張を有効にするためにインポート
import "./externalKeyConfig";
import type {
  WebExternalKeyConfig,
} from "./externalKeyConfig";
import type { WebResolverContextMap } from "./resolverContext";

import {
  collectionConfig,
  createCollectionQueries,
  createCollectionReference,
} from "@zodapp/zod-firebase";
import { z } from "zod";

const testCollection = collectionConfig({
  path: "/test/:testId" as const,
  fieldKeys: [] as const,
  schema: z.object({ name: z.string() }),
});
const testReference = createCollectionReference(testCollection, {
  labelField: "name",
});
const testQueries = createCollectionQueries(testCollection, {
  all: () => ({}),
});

describe("ExternalKeyConfig 型テスト", () => {
  describe("ResolverContextRegistry の型拡張確認", () => {
    it("ResolverContextRegistry に map が登録されている", () => {
      expectTypeOf<ResolverContextRegistry>().toHaveProperty("map");
    });

    it("RegisteredResolverContextMap は WebResolverContextMap と一致する", () => {
      expectTypeOf<RegisteredResolverContextMap>().toEqualTypeOf<WebResolverContextMap>();
    });
  });

  describe("RegisteredExternalKeyConfig の型拡張確認", () => {
    it("RegisteredExternalKeyConfig は WebExternalKeyConfig と一致する", () => {
      expectTypeOf<RegisteredExternalKeyConfig>().toEqualTypeOf<WebExternalKeyConfig>();
    });
  });

  describe("zf.externalKey.registry の型チェック", () => {
    it("workspace contextId で直接指定できる", () => {
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: {
          type: "firestore",
          reference: testReference,
          contextId: "workspace",
          getQuery: (_value, _context) => testQueries.queries.all(),
        },
      });
      expectTypeOf(schema).toBeObject();
    });

    it("workspace contextId で関数形式で指定できる", () => {
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: () => ({
          type: "firestore",
          reference: testReference,
          contextId: "workspace",
          getQuery: (_value, _context) => testQueries.queries.all(),
        }),
      });
      expectTypeOf(schema).toBeObject();
    });

    it("必須フィールドを持つ正しい設定がエラーにならない", () => {
      const config = {
        type: "firestore" as const,
        reference: testReference,
        contextId: "workspace" as const,
        getQuery: (_value: string, _context: { workspaceId: string }) =>
          testQueries.queries.all(),
      } satisfies WebExternalKeyConfig;

      expectTypeOf(config).toMatchTypeOf<WebExternalKeyConfig>();
    });
  });

  describe("不正な型のエラー検出（コンパイル時チェック）", () => {
    it("不正な type を指定するとエラーになる（コメント参照）", () => {
      expectTypeOf<"firestore">().not.toEqualTypeOf<"invalid">();
    });

    it("contextId は 'workspace' のみ許容される", () => {
      type AllowedContextId = WebExternalKeyConfig extends {
        contextId: infer C;
      }
        ? C
        : never;
      expectTypeOf<"workspace">().toMatchTypeOf<AllowedContextId>();
    });

    it("satisfies を使うと余分なプロパティがエラーになる（コメント参照）", () => {
      expectTypeOf<WebExternalKeyConfig>().not.toHaveProperty("unknownProp");
    });
  });
});
