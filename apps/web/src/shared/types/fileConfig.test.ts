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
      // declare module で拡張した型が正しく反映されているか
      expectTypeOf<RegisteredFileConfig>().toEqualTypeOf<WebFileConfig>();
    });

    it("WebFileConfig は FirebaseStorageFileConfig | MockFileConfig と一致する", () => {
      // 現在の WebFileConfig は2つの型の union
      expectTypeOf<WebFileConfig>().toEqualTypeOf<
        FirebaseStorageFileConfig | MockFileConfig
      >();
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
            storageLocationId: "testLocation",
          },
        });
        expectTypeOf(schema).toBeObject();
      });
    });

    describe("FirebaseStorageFileConfig", () => {
      it("FirebaseStorageFileConfig を直接指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "firebaseStorage",
            storageLocationId: "default",
          },
        });
        expectTypeOf(schema).toBeObject();
      });

      it("FirebaseStorageFileConfig を関数形式で指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: () => ({
            type: "firebaseStorage",
            storageLocationId: "default",
          }),
        });
        expectTypeOf(schema).toBeObject();
      });

      it("FirebaseStorageFileConfig にオプションプロパティを指定できる", () => {
        const schema = zf.string().register(zf.file.registry, {
          label: "テスト",
          fileConfig: {
            type: "firebaseStorage",
            storageLocationId: "default",
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

      it("FirebaseStorageFileConfig として satisfies できる", () => {
        const config = {
          type: "firebaseStorage",
          storageLocationId: "default",
        } satisfies FirebaseStorageFileConfig;

        expectTypeOf(config).toMatchTypeOf<FirebaseStorageFileConfig>();
      });

      it("WebFileConfig として satisfies できる（union）", () => {
        const mockConfig = {
          type: "mock" as const,
        } satisfies WebFileConfig;

        const firebaseConfig = {
          type: "firebaseStorage" as const,
          storageLocationId: "default",
        } satisfies WebFileConfig;

        expectTypeOf(mockConfig).toMatchTypeOf<WebFileConfig>();
        expectTypeOf(firebaseConfig).toMatchTypeOf<WebFileConfig>();
      });
    });
  });

  describe("不正な型のエラー検出（コンパイル時チェック）", () => {
    /**
     * 以下のテストは、不正な型がコンパイル時にエラーになることを確認するための
     * ドキュメント的なコメントです。
     *
     * vitest の expectTypeOf では「エラーになること」を直接テストできないため、
     * コメントで仕様を記述しています。
     */

    it("不正な type を指定するとエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // zf.string().register(zf.file.registry, {
      //   fileConfig: {
      //     type: "s3", // Error: "s3" は "mock" | "firebaseStorage" に代入できない
      //   },
      // });

      expectTypeOf<WebFileConfig["type"]>().toEqualTypeOf<"firebaseStorage" | "mock">();
    });

    it("FirebaseStorageFileConfig で storageLocationId が欠けているとエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // zf.string().register(zf.file.registry, {
      //   fileConfig: {
      //     type: "firebaseStorage",
      //     // storageLocationId: 欠落 - Error
      //   },
      // });

      // storageLocationId は FirebaseStorageFileConfig の必須プロパティ
      type Required = keyof FirebaseStorageFileConfig;
      expectTypeOf<"storageLocationId">().toMatchTypeOf<Required>();
    });

    it("MockFileConfig では storageLocationId はオプショナル（コメント参照）", () => {
      // MockFileConfig では storageLocationId は任意
      const config: MockFileConfig = {
        type: "mock",
        // storageLocationId: 省略可能
      };
      expectTypeOf(config).toMatchTypeOf<MockFileConfig>();

      // storageLocationId を指定しても OK
      const configWithLocation: MockFileConfig = {
        type: "mock",
        storageLocationId: "testLocation",
      };
      expectTypeOf(configWithLocation).toMatchTypeOf<MockFileConfig>();
    });

    /**
     * 余分なプロパティのエラー検出について:
     *
     * TypeScript の型システムでは、オブジェクトリテラルに対する
     * Excess Property Check（余分なプロパティチェック）は限定的です。
     *
     * - 直接オブジェクトリテラルを渡す場合: 余分なプロパティはエラー
     * - 変数を介して渡す場合: 余分なプロパティは許容される（構造的部分型）
     *
     * 例:
     * ```ts
     * // これはエラー（直接リテラル）
     * zf.string().register(zf.file.registry, {
     *   fileConfig: {
     *     type: "mock",
     *     unknownProp: "value", // Error: 余分なプロパティ
     *   },
     * });
     *
     * // これはエラーにならない（変数経由）
     * const config = {
     *   type: "mock" as const,
     *   unknownProp: "value",
     * };
     * zf.string().register(zf.file.registry, {
     *   fileConfig: config, // OK（構造的部分型により許容）
     * });
     * ```
     *
     * satisfies を使うことで、変数定義時にも余分なプロパティをチェックできます。
     */
    it("satisfies を使うと余分なプロパティがエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // const config = {
      //   type: "mock" as const,
      //   unknownProp: "value", // Error: satisfies により余分なプロパティが検出される
      // } satisfies MockFileConfig;

      expectTypeOf<MockFileConfig>().not.toHaveProperty("unknownProp");
      expectTypeOf<FirebaseStorageFileConfig>().not.toHaveProperty("unknownProp");
    });
  });

  describe("Union 型の型ガードテスト", () => {
    it("type フィールドで型を絞り込める", () => {
      // 関数の引数として受け取ることで、リテラル型による過度な narrowing を回避
      const narrowByType = (config: WebFileConfig) => {
        if (config.type === "mock") {
          expectTypeOf(config).toMatchTypeOf<MockFileConfig>();
        } else {
          expectTypeOf(config).toMatchTypeOf<FirebaseStorageFileConfig>();
        }
      };

      // 関数が存在することを確認（実行時テストではなく型テスト）
      expectTypeOf(narrowByType).toBeFunction();
    });
  });
});
