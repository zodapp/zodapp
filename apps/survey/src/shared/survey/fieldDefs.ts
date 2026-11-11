import { z } from "zod";
import { zf } from "@zodapp/zod-form";

/**
 * アンケートの質問（フィールド）定義 DSL。
 *
 * この DSL 自体も zf スキーマとして定義しているため、
 * 「質問を編集するフォーム」も AutoForm / Switch で自動生成できる（メタスキーマ）。
 * 保存された定義は実行時に `buildSurveySchema()` で回答フォーム用の
 * zf スキーマへ変換される。
 */

/** 質問の内部 ID（回答 answers のキーになる） */
export const generateFieldId = (): string =>
  `f${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

/**
 * 全種別に共通の shape。
 *
 * - `type`: discriminatedUnion の判別子。UI では union セレクタが担当するので hidden
 * - `id`: 自動採番。`.default()` を付けておくと、union セレクタで種別を選んだ時点で
 *   `getDefaultValue(arm)` が走って採番される（zod-form-mantine の union 実装）。
 *   hidden メタは「一番外側」の schema に付ける必要があるため `.default()` の後に付ける
 */
// register の meta 型は schema 型に依存した conditional type なので、
// 未解決のジェネリック（TType）のままでは解決できない。
// 一度 ZodLiteral<string> に広げて register し、リテラル型へ戻す
const typeLiteral = <TType extends string>(type: TType): z.ZodLiteral<TType> =>
  (z.literal(type) as z.ZodLiteral<string>).register(zf.literal.registry, {
    hidden: true,
  }) as z.ZodLiteral<TType>;

const fieldBaseShape = <TType extends string>(type: TType) => ({
  type: typeLiteral(type),
  id: zf
    .string()
    .default(() => generateFieldId())
    .register(zf.common.registry, { hidden: true }),
  label: zf
    .string()
    .min(1, "質問文を入力してください")
    .register(zf.string.registry, { label: "質問文" }),
  required: zf
    .boolean()
    .register(zf.boolean.registry, { label: "回答必須", uiType: "checkbox" })
    .optional(),
});

const selectOptionSchema = z
  .object({
    value: zf
      .string()
      .default(() => generateFieldId())
      .register(zf.common.registry, { hidden: true }),
    label: zf
      .string()
      .min(1, "選択肢を入力してください")
      .register(zf.string.registry, { label: "選択肢" }),
  })
  .register(zf.object.registry, {});

/** 質問 1 件の定義（種別ごとの discriminatedUnion） */
export const surveyFieldSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        ...fieldBaseShape("text"),
        maxLength: zf
          .number()
          .min(1)
          .register(zf.number.registry, { label: "最大文字数" })
          .optional(),
      })
      .register(zf.object.registry, { label: "短文テキスト" }),
    z
      .object({
        ...fieldBaseShape("multiline"),
      })
      .register(zf.object.registry, { label: "長文テキスト" }),
    z
      .object({
        ...fieldBaseShape("number"),
        min: zf
          .number()
          .register(zf.number.registry, { label: "最小値" })
          .optional(),
        max: zf
          .number()
          .register(zf.number.registry, { label: "最大値" })
          .optional(),
      })
      .register(zf.object.registry, { label: "数値" }),
    z
      .object({
        ...fieldBaseShape("select"),
        options: zf
          .array(selectOptionSchema)
          .min(1, "選択肢を 1 つ以上追加してください")
          .register(zf.array.registry, {
            label: "選択肢",
            discriminator: "value",
          }),
      })
      .register(zf.object.registry, { label: "単一選択" }),
    z
      .object({
        ...fieldBaseShape("boolean"),
      })
      .register(zf.object.registry, { label: "チェック（同意など）" }),
    z
      .object({
        ...fieldBaseShape("date"),
      })
      .register(zf.object.registry, { label: "日付" }),
  ])
  .register(zf.union.registry, {
    selectorLabel: "質問の種類",
    unselectedLabel: "種類を選択してください",
  });

/** 質問の配列（アンケート定義の本体） */
export const surveyFieldsSchema = zf
  .array(surveyFieldSchema)
  .register(zf.array.registry, { label: "質問", discriminator: "id" })
  .default([]);

export type SurveyFieldDef = z.infer<typeof surveyFieldSchema>;
export type SurveyFieldType = SurveyFieldDef["type"];
