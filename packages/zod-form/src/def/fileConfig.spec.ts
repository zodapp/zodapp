/**
 * FileConfig の型テスト
 *
 * このファイルは apps/web の型拡張が正しく機能するかをテストするための
 * 型専用テストファイルです。
 *
 * 注意: このテストは apps/web の declare module による型拡張が
 * 適用された状態でのみ正しく動作します。
 * packages/zod-form 単体では RegisteredFileConfig は
 * BaseFileConfig にフォールバックします。
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "./index";
import type {
  RegisteredFileConfig,
  BaseFileConfig,
  FileConfigRegistry,
} from "../file/types";

describe("FileConfig 型テスト（base package）", () => {
  describe("FileConfigRegistry の初期状態", () => {
    it("FileConfigRegistry は初期状態では空オブジェクト型", () => {
      // declare module で拡張されていない状態
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      expectTypeOf<FileConfigRegistry>().toEqualTypeOf<{}>();
    });

    it("RegisteredFileConfig は未拡張時 BaseFileConfig にフォールバック", () => {
      // FileConfigRegistry に config が定義されていない場合、
      // RegisteredFileConfig は BaseFileConfig にフォールバック
      expectTypeOf<RegisteredFileConfig>().toEqualTypeOf<BaseFileConfig>();
    });
  });

  describe("zf.file.registry の基本型チェック", () => {
    it("BaseFileConfig を直接指定できる", () => {
      // 基本的な設定（type のみ必須）
      const schema = zf.string().register(zf.file.registry, {
        label: "テスト",
        fileConfig: {
          type: "anyStorage",
        },
      });
      expectTypeOf(schema).toBeObject();
    });

    it("BaseFileConfig を関数形式で指定できる", () => {
      const schema = zf.string().register(zf.file.registry, {
        label: "テスト",
        fileConfig: () => ({
          type: "anyStorage",
        }),
      });
      expectTypeOf(schema).toBeObject();
    });

    it("BaseFileConfig のオプションプロパティを指定できる", () => {
      const schema = zf.string().register(zf.file.registry, {
        label: "テスト",
        fileConfig: {
          type: "anyStorage",
          mimeTypes: ["image/png", "image/jpeg"],
          maxSize: 5 * 1024 * 1024,
        },
      });
      expectTypeOf(schema).toBeObject();
    });
  });

  describe("BaseFileConfig の型構造", () => {
    it("BaseFileConfig は type を持つ", () => {
      expectTypeOf<BaseFileConfig["type"]>().toEqualTypeOf<string>();
    });

    it("BaseFileConfig は mimeTypes と maxSize をオプションで持つ", () => {
      type MimeTypes = BaseFileConfig["mimeTypes"];
      type MaxSize = BaseFileConfig["maxSize"];

      expectTypeOf<MimeTypes>().toEqualTypeOf<string[] | undefined>();
      expectTypeOf<MaxSize>().toEqualTypeOf<number | undefined>();
    });
  });

  describe("型拡張のドキュメント", () => {
    /**
     * apps/web での型拡張パターン:
     *
     * ```typescript
     * // apps/web/src/shared/types/fileConfig.ts
     * import type { FirebaseStorageFileConfig } from "@zodapp/zod-form-firebase";
     * import type { BaseFileConfig } from "@zodapp/zod-form";
     *
     * export type MockFileConfig = BaseFileConfig<"mock"> & {
     *   storageLocationId?: string;
     * };
     *
     * export type WebFileConfig = FirebaseStorageFileConfig | MockFileConfig;
     *
     * declare module "@zodapp/zod-form/file/types" {
     *   interface FileConfigRegistry {
     *     config: WebFileConfig;
     *   }
     * }
     * ```
     *
     * この拡張により:
     * - RegisteredFileConfig が WebFileConfig と等しくなる
     * - zf.file.registry の fileConfig が
     *   FirebaseStorageFileConfig | MockFileConfig のみを受け入れる
     * - 不正な type（"firebaseStorage" | "mock" 以外）がコンパイルエラーになる
     * - FirebaseStorageFileConfig では storageLocationId が必須になる
     */
    it("型拡張の仕組みを理解するためのドキュメント的テスト", () => {
      // RegisteredFileConfig の型推論を確認
      type Registered = RegisteredFileConfig;

      // 未拡張の場合は BaseFileConfig
      expectTypeOf<Registered>().toEqualTypeOf<BaseFileConfig>();

      // BaseFileConfig は type を持つ
      expectTypeOf<BaseFileConfig["type"]>().toEqualTypeOf<string>();
    });
  });
});
