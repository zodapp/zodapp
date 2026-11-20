import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/validatePreceding";

/** form-demo の日本語の辞書（validatePreceding） */
export const ja = {
  "formDemo.page.validatePreceding.title": "前方フィールドの一括検証",
  "formDemo.page.validatePreceding.description":
    "後方のフィールドへフォーカスした時点で、それより前の未入力フィールドをまとめて検証する（AutoForm に組み込みの ValidatePrecedingFieldsProvider の挙動）",
  "formDemo.validatePreceding.name.min": "氏名を入力してください",
  "formDemo.validatePreceding.name": "氏名（必須）",
  "formDemo.validatePreceding.email.min": "メールアドレスを入力してください",
  "formDemo.validatePreceding.email": "メールアドレス（必須）",
  "formDemo.validatePreceding.tel.min": "電話番号を入力してください",
  "formDemo.validatePreceding.tel": "電話番号（必須）",
  "formDemo.validatePreceding.note": "備考（任意）",
} satisfies MessagesOf<typeof en>;
