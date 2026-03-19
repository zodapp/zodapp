/**
 * fileConfig.ts の型テスト
 *
 * declare module による型拡張が正しく機能しているかを検証する
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "@zodapp/zod-form";
import type { RegisteredFileConfig } from "@zodapp/zod-form/file/types";
import type { FirebaseStorageFileConfig } from "@zodapp/zod-form-firebase";

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

    it("FirebaseStorageFileConfig は type: 'firebaseStorage' を持つ", () => {
      expectTypeOf<FirebaseStorageFileConfig["type"]>().toEqualTypeOf<"firebaseStorage">();
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

    describe("FirebaseStorageFileConfig (workspace context)", () => {
      it("workspace contextId で直接指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "firebaseStorage",
            contextId: "workspace",
            getLocation: (context) => ({
              parentPath: `workspaces/${context.workspaceId}/files`,
            }),
          },
        });
        expectTypeOf(schema).toBeObject();
      });

      it("workspace contextId で関数形式で指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: () => ({
            type: "firebaseStorage" as const,
            contextId: "workspace" as const,
            getLocation: (context: { workspaceId: string }) => ({
              parentPath: `workspaces/${context.workspaceId}/files`,
            }),
          }),
        });
        expectTypeOf(schema).toBeObject();
      });

      it("オプションプロパティを指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "firebaseStorage",
            contextId: "workspace",
            getLocation: (context) => ({
              parentPath: `workspaces/${context.workspaceId}/files`,
            }),
            mimeTypes: ["image/png"],
            maxSize: 10 * 1024 * 1024,
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

      it("WebFileConfig として satisfies できる（firebaseStorage）", () => {
        const firebaseConfig = {
          type: "firebaseStorage" as const,
          contextId: "workspace" as const,
          getLocation: (context: { workspaceId: string }) => ({
            parentPath: `workspaces/${context.workspaceId}/files`,
          }),
        } satisfies WebFileConfig;

        expectTypeOf(firebaseConfig).toMatchTypeOf<WebFileConfig>();
      });
    });
  });

  describe("不正な型のエラー検出（コンパイル時チェック）", () => {
    it("不正な type を指定するとエラーになる（コメント参照）", () => {
      expectTypeOf<WebFileConfig["type"]>().toEqualTypeOf<
        "firebaseStorage" | "mock"
      >();
    });

    it("contextId は 'workspace' のみ許容される", () => {
      type FirebaseVariant = Extract<WebFileConfig, { type: "firebaseStorage" }>;
      type AllowedContextId = FirebaseVariant["contextId"];
      expectTypeOf<"workspace">().toMatchTypeOf<AllowedContextId>();
    });

    it("satisfies を使うと余分なプロパティがエラーになる（コメント参照）", () => {
      expectTypeOf<MockFileConfig>().not.toHaveProperty("unknownProp");
    });
  });

  describe("Union 型の型ガードテスト", () => {
    it("type フィールドで型を絞り込める", () => {
      const narrowByType = (config: WebFileConfig) => {
        if (config.type === "mock") {
          expectTypeOf(config).toMatchTypeOf<MockFileConfig>();
        } else {
          expectTypeOf(config.contextId).toEqualTypeOf<"workspace">();
        }
      };

      expectTypeOf(narrowByType).toBeFunction();
    });
  });
});
