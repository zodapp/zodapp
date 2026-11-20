/**
 * computed の context 型推論テスト
 *
 * declare module による ResolverContext 型拡張が
 * zf.computed / zfReact.computed の両方で正しく機能するかを検証する
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf, type ComputedMetaDef } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import type {
  RegisteredResolverContextMap,
  ResolverContextRegistry,
} from "@zodapp/zod-form/resolverContext/types";

// declare module による型拡張を有効にするためにインポート
import "./resolverContext";
import type { WebResolverContextMap } from "./resolverContext";

describe("computed context 型テスト", () => {
  describe("ResolverContextRegistry の型拡張確認", () => {
    it("ResolverContextRegistry に map が登録されている", () => {
      expectTypeOf<ResolverContextRegistry>().toHaveProperty("map");
    });

    it("RegisteredResolverContextMap は WebResolverContextMap と一致する", () => {
      expectTypeOf<RegisteredResolverContextMap>().toEqualTypeOf<WebResolverContextMap>();
    });
  });

  describe("zf.computed.registry の型チェック", () => {
    it("contextId に応じて context が推論される", () => {
      const schema = zf.computed().register(zf.computed.registry, {
        label: "テスト",
        contextId: "workspace",
        compute: ({ context }) => {
          expectTypeOf(context).toEqualTypeOf<
            WebResolverContextMap["workspace"]
          >();
          return context.workspaceId;
        },
      });

      expectTypeOf(schema).toBeObject();
    });

    it("contextId を省略すると context は undefined になる", () => {
      type ContextlessComputed = Extract<
        ComputedMetaDef<string, unknown>,
        { contextId?: undefined; dependsOnParent?: false }
      >;

      expectTypeOf<
        Parameters<ContextlessComputed["compute"]>[0]["context"]
      >().toEqualTypeOf<undefined>();
    });

    it("dependsOnParent: true のときだけ parent が型に入る", () => {
      zf.computed().register(zf.computed.registry, {
        dependsOnParent: true,
        compute: ({ parent }) => {
          expectTypeOf(parent).toBeAny();
          return "";
        },
      });
      zf.computed().register(zf.computed.registry, {
        compute: ({ parent }) => {
          expectTypeOf(parent).toEqualTypeOf<undefined>();
          return "";
        },
      });
    });
  });

  describe("zfReact.computed.registry の型チェック", () => {
    it("contextId に応じて context が推論される", () => {
      const schema = zfReact.computed().register(zfReact.computed.registry, {
        label: "テスト",
        contextId: "workspace",
        compute: ({ context }) => {
          expectTypeOf(context).toEqualTypeOf<
            WebResolverContextMap["workspace"]
          >();
          return context.workspaceId;
        },
      });

      expectTypeOf(schema).toBeObject();
    });
  });
});
