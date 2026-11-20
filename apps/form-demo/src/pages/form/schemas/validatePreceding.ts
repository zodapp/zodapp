import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconListCheck } from "@tabler/icons-react";

export const formId = "validatePreceding";
export const title = msgKey(
  "formDemo.page.validatePreceding.title" /* i18n: 前方フィールドの一括検証 */,
);
export const description = msgKey(
  "formDemo.page.validatePreceding.description" /* i18n: 後方のフィールドへフォーカスした時点で、それより前の未入力フィールドをまとめて検証する（AutoForm に組み込みの ValidatePrecedingFieldsProvider の挙動） */,
);
export const icon = IconListCheck;
export const category = "Advanced";

// 上から順に入力させたい申込フォームの例。
// 「氏名」を飛ばして「電話番号」にフォーカスすると、
// 飛ばした必須フィールドに即座にエラーが表示される。
//
// この挙動は zod-form-react の ValidatePrecedingFieldsProvider が提供する。
// AutoForm は内部でこの Provider を組み込んでいるため設定は不要。
// FormProvider + Switch で独自フォームを組む場合は、フィールド群を
// <ValidatePrecedingFieldsProvider> で囲むことで同じ挙動になる
// （disabled prop で無効化もできる）。
export const schema = z
  .object({
    name: zf
      .string()
      .min(
        1,
        msgKey(
          "formDemo.validatePreceding.name.min" /* i18n: 氏名を入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.validatePreceding.name" /* i18n: 氏名（必須） */,
        ),
      }),
    email: zf
      .string()
      .min(
        1,
        msgKey(
          "formDemo.validatePreceding.email.min" /* i18n: メールアドレスを入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.validatePreceding.email" /* i18n: メールアドレス（必須） */,
        ),
        uiType: "email",
      }),
    tel: zf
      .string()
      .min(
        1,
        msgKey(
          "formDemo.validatePreceding.tel.min" /* i18n: 電話番号を入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.validatePreceding.tel" /* i18n: 電話番号（必須） */,
        ),
        uiType: "tel",
      }),
    note: zf
      .string()
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.validatePreceding.note" /* i18n: 備考（任意） */,
        ),
        uiType: "multiline",
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  name: "",
  email: "",
  tel: "",
};

export type SchemaType = z.infer<typeof schema>;
