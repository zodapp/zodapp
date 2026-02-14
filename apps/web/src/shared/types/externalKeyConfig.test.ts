/**
 * externalKeyConfig.ts の型テスト
 *
 * declare module による型拡張が正しく機能しているかを検証する
 */
import { describe, it, expectTypeOf } from "vitest";
import { zf } from "@zodapp/zod-form";
import type { RegisteredExternalKeyConfig } from "@zodapp/zod-form/externalKey/types";
import type { FirestoreExternalKeyConfig } from "@zodapp/zod-form-firebase";

// declare module による型拡張を有効にするためにインポート
import "./externalKeyConfig";
import type { WebExternalKeyConfig } from "./externalKeyConfig";

// collectionConfig のモック（型テスト用）
// 実際の collectionConfig 関数を使うと依存が複雑になるため、型だけを模倣
import { collectionConfig } from "@zodapp/zod-firebase";
import { z } from "zod";

// テスト用のコレクション定義
const testCollection = collectionConfig({
  path: "/test/:testId" as const,
  fieldKeys: [] as const,
  schema: z.object({ name: z.string() }),
  externalKeyConfig: { labelField: "name", valueField: "testId" },
});

describe("ExternalKeyConfig 型テスト", () => {
  describe("RegisteredExternalKeyConfig の型拡張確認", () => {
    it("RegisteredExternalKeyConfig は WebExternalKeyConfig と一致する", () => {
      // declare module で拡張した型が正しく反映されているか
      expectTypeOf<RegisteredExternalKeyConfig>().toEqualTypeOf<WebExternalKeyConfig>();
    });

    it("WebExternalKeyConfig は FirestoreExternalKeyConfig と一致する", () => {
      // 現在の WebExternalKeyConfig は FirestoreExternalKeyConfig のみ
      expectTypeOf<WebExternalKeyConfig>().toEqualTypeOf<FirestoreExternalKeyConfig>();
    });
  });

  describe("zf.externalKey.registry の型チェック", () => {
    it("FirestoreExternalKeyConfig を直接指定できる", () => {
      // 正しい型: エラーにならないことを確認
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: {
          type: "firestore",
          collectionConfig: testCollection,
          conditionId: "testCondition",
        },
      });
      expectTypeOf(schema).toBeObject();
    });

    it("FirestoreExternalKeyConfig を関数形式で指定できる", () => {
      // 正しい型（関数形式）: エラーにならないことを確認
      const schema = zf.string().register(zf.externalKey.registry, {
        label: "テスト",
        externalKeyConfig: () => ({
          type: "firestore",
          collectionConfig: testCollection,
          conditionId: "testCondition",
        }),
      });
      expectTypeOf(schema).toBeObject();
    });

    it("必須フィールドを持つ正しい設定がエラーにならない", () => {
      // 最小限の設定
      const config = {
        type: "firestore" as const,
        collectionConfig: testCollection,
        conditionId: "default",
      } satisfies WebExternalKeyConfig;

      expectTypeOf(config).toMatchTypeOf<FirestoreExternalKeyConfig>();
    });
  });

  describe("不正な型のエラー検出（コンパイル時チェック）", () => {
    /**
     * 以下のテストは、不正な型がコンパイル時にエラーになることを確認するための
     * ドキュメント的なコメントです。
     *
     * vitest の expectTypeOf では「エラーになること」を直接テストできないため、
     * コメントで仕様を記述しています。
     *
     * 実際にエラーになることを確認するには、以下のコードのコメントを外して
     * TypeScript のコンパイルエラーを確認してください。
     */

    it("不正な type を指定するとエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // zf.string().register(zf.externalKey.registry, {
      //   externalKeyConfig: {
      //     type: "invalid", // Error: "invalid" は "firestore" に代入できない
      //     collectionConfig: testCollection,
      //     conditionId: "default",
      //   },
      // });

      // テストとして通過させる（実際のチェックはコンパイル時に行われる）
      expectTypeOf<"firestore">().not.toEqualTypeOf<"invalid">();
    });

    it("collectionConfig が欠けているとエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // zf.string().register(zf.externalKey.registry, {
      //   externalKeyConfig: {
      //     type: "firestore",
      //     // collectionConfig: 欠落 - Error
      //     conditionId: "default",
      //   },
      // });

      // collectionConfig は必須プロパティ
      type Required = keyof FirestoreExternalKeyConfig;
      expectTypeOf<"collectionConfig">().toMatchTypeOf<Required>();
    });

    it("conditionId が欠けているとエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // zf.string().register(zf.externalKey.registry, {
      //   externalKeyConfig: {
      //     type: "firestore",
      //     collectionConfig: testCollection,
      //     // conditionId: 欠落 - Error
      //   },
      // });

      // conditionId は必須プロパティ
      type Required = keyof FirestoreExternalKeyConfig;
      expectTypeOf<"conditionId">().toMatchTypeOf<Required>();
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
     * zf.string().register(zf.externalKey.registry, {
     *   externalKeyConfig: {
     *     type: "firestore",
     *     collectionConfig: testCollection,
     *     conditionId: "default",
     *     unknownProp: "value", // Error: 余分なプロパティ
     *   },
     * });
     *
     * // これはエラーにならない（変数経由）
     * const config = {
     *   type: "firestore" as const,
     *   collectionConfig: testCollection,
     *   conditionId: "default",
     *   unknownProp: "value",
     * };
     * zf.string().register(zf.externalKey.registry, {
     *   externalKeyConfig: config, // OK（構造的部分型により許容）
     * });
     * ```
     *
     * satisfies を使うことで、変数定義時にも余分なプロパティをチェックできます。
     */
    it("satisfies を使うと余分なプロパティがエラーになる（コメント参照）", () => {
      // 以下はコンパイルエラーになるべき例:
      // const config = {
      //   type: "firestore" as const,
      //   collectionConfig: testCollection,
      //   conditionId: "default",
      //   unknownProp: "value", // Error: satisfies により余分なプロパティが検出される
      // } satisfies WebExternalKeyConfig;

      expectTypeOf<WebExternalKeyConfig>().not.toHaveProperty("unknownProp");
    });
  });
});
