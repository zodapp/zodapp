/**
 * ExternalKeyConfig の型テスト
 *
 * このファイルは apps/web の型拡張が正しく機能するかをテストするための
 * 型専用テストファイルです。
 *
 * 注意: このテストは apps/web の declare module による型拡張が
 * 適用された状態でのみ正しく動作します。
 * packages/zod-form 単体では RegisteredExternalKeyConfig は
 * BaseExternalKeyConfig にフォールバックします。
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "./index";
import type {
  RegisteredExternalKeyConfig,
  BaseExternalKeyConfig,
  ExternalKeyConfigRegistry,
} from "../externalKey/types";

describe("ExternalKeyConfig 型テスト（base package）", () => {
  describe("ExternalKeyConfigRegistry の初期状態", () => {
    it("ExternalKeyConfigRegistry は初期状態では空オブジェクト型", () => {
      // declare module で拡張されていない状態
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      expectTypeOf<ExternalKeyConfigRegistry>().toEqualTypeOf<{}>();
    });

    it("RegisteredExternalKeyConfig は未拡張時 BaseExternalKeyConfig にフォールバック", () => {
      // ExternalKeyConfigRegistry に config が定義されていない場合、
      // RegisteredExternalKeyConfig は BaseExternalKeyConfig にフォールバック
      expectTypeOf<RegisteredExternalKeyConfig>().toEqualTypeOf<BaseExternalKeyConfig>();
    });
  });

  describe("zf.externalKey.registry の基本型チェック", () => {
    it("BaseExternalKeyConfig を直接指定できる", () => {
      // 基本的な設定（type のみ必須）
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: {
          type: "anyResolver",
        },
      });
      expectTypeOf(schema).toBeObject();
    });

    it("BaseExternalKeyConfig を関数形式で指定できる", () => {
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: () => ({
          type: "anyResolver",
        }),
      });
      expectTypeOf(schema).toBeObject();
    });

    /**
     * 追加プロパティはエラーになる:
     *
     * BaseExternalKeyConfig は `{ type: TType }` のみを持つため、
     * 追加プロパティを指定するとコンパイルエラーになります。
     *
     * ```typescript
     * // これはコンパイルエラー
     * zf.string().register(zf.externalKey.registry, {
     *   externalKeyConfig: {
     *     type: "customResolver",
     *     customOption: "value", // Error: 余分なプロパティ
     *   },
     * });
     * ```
     *
     * アプリ側で declare module による型拡張を行い、
     * 具体的な Config 型（FirestoreExternalKeyConfig など）を登録することで、
     * 追加プロパティを持つ設定を使用できるようになります。
     */
  });

  describe("型拡張のドキュメント", () => {
    /**
     * apps/web での型拡張パターン:
     *
     * ```typescript
     * // apps/web/src/shared/types/externalKeyConfig.ts
     * import type { FirestoreExternalKeyConfig } from "@zodapp/zod-form-firebase";
     *
     * export type WebExternalKeyConfig = FirestoreExternalKeyConfig;
     *
     * declare module "@zodapp/zod-form/externalKey/types" {
     *   interface ExternalKeyConfigRegistry {
     *     config: WebExternalKeyConfig;
     *   }
     * }
     * ```
     *
     * この拡張により:
     * - RegisteredExternalKeyConfig が WebExternalKeyConfig と等しくなる
     * - zf.externalKey.registry の externalKeyConfig が
     *   FirestoreExternalKeyConfig のみを受け入れるようになる
     * - 不正な type（"firestore" 以外）がコンパイルエラーになる
     * - 必須フィールド（collectionConfig, conditionId）の欠落がエラーになる
     */
    it("型拡張の仕組みを理解するためのドキュメント的テスト", () => {
      // RegisteredExternalKeyConfig の型推論を確認
      type Registered = RegisteredExternalKeyConfig;

      // 未拡張の場合は BaseExternalKeyConfig
      expectTypeOf<Registered>().toEqualTypeOf<BaseExternalKeyConfig>();

      // BaseExternalKeyConfig は type を持つ
      expectTypeOf<BaseExternalKeyConfig["type"]>().toEqualTypeOf<string>();
    });
  });
});
