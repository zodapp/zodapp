/**
 * ExternalKeyConfig の型テスト
 *
 * このファイルは apps/form-demo の型拡張が正しく機能するかをテストするための
 * 型専用テストファイルです。
 *
 * 注意: このテストは apps/form-demo の declare module による型拡張が
 * 適用された状態でのみ正しく動作します。
 * packages/zod-form 単体では RegisteredExternalKeyConfig は
 * BaseExternalKeyConfig & Record<string, unknown> にフォールバックします。
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "./index";
import type {
  RegisteredExternalKeyConfig,
  BaseExternalKeyConfig,
  ExternalKeyConfigRegistry,
} from "../externalKey/types";
import type {
  RegisteredValueActionConfig,
  RegisteredValueActionParams,
  BaseValueActionConfig,
  BaseValueActionParams,
} from "../valueAction/types";

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

    it("RegisteredValueActionConfig は未拡張時 BaseValueActionConfig にフォールバック", () => {
      expectTypeOf<RegisteredValueActionConfig>().toEqualTypeOf<BaseValueActionConfig>();
    });

    it("RegisteredValueActionParams は未拡張時 BaseValueActionParams にフォールバック", () => {
      expectTypeOf<RegisteredValueActionParams>().toEqualTypeOf<BaseValueActionParams>();
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

    it("BaseExternalKeyConfig を関数形式では指定できない（ただのデータにする）", () => {
      zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        // @ts-expect-error 関数で返す形は持たない。変えるときは zf.dynamic で包む
        externalKeyConfig: () => ({
          type: "anyResolver",
        }),
      });
    });

    it("valueAction を指定できる", () => {
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: {
          type: "anyResolver",
        },
        valueAction: {
          contextId: "anyAction",
          getActionParams: ({ value, context }) => ({
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
     * 具体的な Config 型（DynamoExternalKeyConfig など）を登録すると、
     * plugin 固有フィールドも型安全に制限できます。
     */
  });

  describe("型拡張のドキュメント", () => {
    /**
     * アプリでの型拡張パターン（例：apps/taskmanager）:
     *
     * ```typescript
     * // src/shared/form/externalKeyConfig.ts
     * import type { DynamoExternalKeyConfig } from "@zodapp/zod-form-dynamodb";
     *
     * export type WebExternalKeyConfig = DynamoExternalKeyConfig;
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
     *   DynamoExternalKeyConfig のみを受け入れるようになる
     * - 不正な type（"dynamodb" 以外）がコンパイルエラーになる
     * - 必須フィールド（collectionConfig, contextId）の欠落がエラーになる
     */
    it("型拡張の仕組みを理解するためのドキュメント的テスト", () => {
      // RegisteredExternalKeyConfig の型推論を確認
      type Registered = RegisteredExternalKeyConfig;

      // 未拡張の場合は plugin 固有フィールドを許す fallback
      expectTypeOf<Registered>().toEqualTypeOf<UnregisteredExternalKeyConfigFallback>();

      // BaseExternalKeyConfig は type を持つ
      expectTypeOf<BaseExternalKeyConfig["type"]>().toEqualTypeOf<string>();

      // BaseValueActionConfig は contextId（省略可）/ getActionParams を持つ
      expectTypeOf<BaseValueActionConfig["contextId"]>().toEqualTypeOf<
        string | undefined
      >();
    });
  });
});
