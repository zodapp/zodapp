/**
 * fileConfig.ts の型テスト
 *
 * declare module による型拡張が正しく機能しているかを検証する
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "@zodapp/zod-form";
import type { RegisteredFileConfig } from "@zodapp/zod-form/file/types";

// declare module による型拡張を有効にするためにインポート
import "./fileConfig";
import type { WebFileConfig, MockFileConfig } from "./fileConfig";

describe("FileConfig 型テスト", () => {
  describe("RegisteredFileConfig の型拡張確認", () => {
    it("RegisteredFileConfig は WebFileConfig と一致する", () => {
      expectTypeOf<RegisteredFileConfig>().toEqualTypeOf<WebFileConfig>();
    });

    it("MockFileConfig は type: 'mock' を持つ", () => {
      expectTypeOf<MockFileConfig["type"]>().toEqualTypeOf<"mock">();
    });
  });

  describe("zf.file.registry の型チェック", () => {
    describe("MockFileConfig", () => {
      it("MockFileConfig を直接指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "mock",
          },
        });
        expectTypeOf(schema).toBeObject();
      });

      it("MockFileConfig を関数形式で指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: () => ({
            type: "mock",
          }),
        });
        expectTypeOf(schema).toBeObject();
      });

      it("MockFileConfig にオプションプロパティを指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "mock",
            mimeTypes: ["image/png", "image/jpeg"],
            maxSize: 5 * 1024 * 1024,
          },
        });
        expectTypeOf(schema).toBeObject();
      });
    });

    describe("satisfies による型チェック", () => {
      it("MockFileConfig として satisfies できる", () => {
        const config = {
          type: "mock",
          mimeTypes: ["image/png"],
        } satisfies MockFileConfig;

        expectTypeOf(config).toMatchTypeOf<MockFileConfig>();
      });

      it("WebFileConfig として satisfies できる（mock）", () => {
        const mockConfig = {
          type: "mock" as const,
        } satisfies WebFileConfig;

        expectTypeOf(mockConfig).toMatchTypeOf<WebFileConfig>();
      });
    });
  });

  describe("不正な型のエラー検出（コンパイル時チェック）", () => {
    it("不正な type を指定するとエラーになる（コメント参照）", () => {
      expectTypeOf<WebFileConfig["type"]>().toEqualTypeOf<"mock">();
    });

    it("satisfies を使うと余分なプロパティがエラーになる（コメント参照）", () => {
      expectTypeOf<MockFileConfig>().not.toHaveProperty("unknownProp");
    });
  });
});
