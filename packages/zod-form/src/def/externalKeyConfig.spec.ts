/**
 * ExternalKeyConfig の型テスト
 *
 * このファイルは apps/web の型拡張が正しく機能するかをテストするための
 * 型専用テストファイルです。
 *
 * 注意: このテストは apps/web の declare module による型拡張が
 * 適用された状態でのみ正しく動作します。
 * packages/zod-form 単体では RegisteredExternalKeyConfig は
 * BaseExternalKeyConfig & Record<string, unknown> にフォールバックします。
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "./index";
import type {
  RegisteredExternalKeyConfig,
  BaseExternalKeyConfig,
  RegisteredExternalKeyActionConfig,
  RegisteredExternalKeyActionParams,
  BaseExternalKeyActionConfig,
  BaseExternalKeyActionParams,
  ExternalKeyConfigRegistry,
} from "../externalKey/types";

type UnregisteredExternalKeyConfigFallback = BaseExternalKeyConfig &
  Record<string, unknown>;

describe("ExternalKeyConfig 型テスト（base package）", () => {
  describe("ExternalKeyConfigRegistry の初期状態", () => {
    it("ExternalKeyConfigRegistry は初期状態では空オブジェクト型", () => {
      // declare module で拡張されていない状態
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      expectTypeOf<ExternalKeyConfigRegistry>().toEqualTypeOf<{}>();
    });

    it("RegisteredExternalKeyConfig は未拡張時に拡張可能な BaseExternalKeyConfig にフォールバック", () => {
      // ExternalKeyConfigRegistry に config が定義されていない場合、
      // RegisteredExternalKeyConfig は plugin 固有フィールドを許す fallback にする
      expectTypeOf<RegisteredExternalKeyConfig>().toEqualTypeOf<UnregisteredExternalKeyConfigFallback>();
    });

    it("RegisteredExternalKeyActionConfig は未拡張時 BaseExternalKeyActionConfig にフォールバック", () => {
      expectTypeOf<RegisteredExternalKeyActionConfig>().toEqualTypeOf<BaseExternalKeyActionConfig>();
    });

    it("RegisteredExternalKeyActionParams は未拡張時 BaseExternalKeyActionParams にフォールバック", () => {
      expectTypeOf<RegisteredExternalKeyActionParams>().toEqualTypeOf<BaseExternalKeyActionParams>();
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

    it("BaseExternalKeyActionConfig を指定できる", () => {
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: {
          type: "anyResolver",
        },
        externalKeyActionConfig: {
          contextId: "anyAction",
          getActionParams: (value: string, context: unknown) => ({
            value,
            context,
          }),
        },
      });
      expectTypeOf(schema).toBeObject();
    });

    /**
     * 未拡張時も追加プロパティは指定できる:
     *
     * zod-form core は plugin 側の具体フィールドを知らないため、
     * BaseExternalKeyConfig に任意の追加プロパティを許す fallback にします。
     *
     * ```typescript
     * zf.string().register(zf.externalKey.registry, {
     *   externalKeyConfig: {
     *     type: "customResolver",
     *     customOption: "value",
     *   },
     * });
     * ```
     *
     * アプリ側で declare module による型拡張を行い、
     * 具体的な Config 型（FirestoreExternalKeyConfig など）を登録すると、
     * plugin 固有フィールドも型安全に制限できます。
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
     * - 必須フィールド（collectionConfig, contextId）の欠落がエラーになる
     */
    it("型拡張の仕組みを理解するためのドキュメント的テスト", () => {
      // RegisteredExternalKeyConfig の型推論を確認
      type Registered = RegisteredExternalKeyConfig;

      // 未拡張の場合は plugin 固有フィールドを許す fallback
      expectTypeOf<Registered>().toEqualTypeOf<UnregisteredExternalKeyConfigFallback>();

      // BaseExternalKeyConfig は type を持つ
      expectTypeOf<BaseExternalKeyConfig["type"]>().toEqualTypeOf<string>();

      // BaseExternalKeyActionConfig は contextId / getActionParams を持つ
      expectTypeOf<BaseExternalKeyActionConfig["contextId"]>().toEqualTypeOf<string>();
    });
  });
});
