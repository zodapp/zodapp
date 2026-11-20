import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveNestedObject";

/** form-demo の日本語の辞書（reactiveNestedObject） */
export const ja = {
  "formDemo.page.reactiveNestedObject.description":
    "reactiveComponentLibrary によるネストオブジェクト。フィールド単位の確認UIあり。",
  "formDemo.reactiveNestedObject.addressSchema.postalCode": "郵便番号",
  "formDemo.reactiveNestedObject.addressSchema.prefecture": "都道府県",
  "formDemo.reactiveNestedObject.addressSchema.city": "市区町村",
  "formDemo.reactiveNestedObject.addressSchema.street": "番地",
  "formDemo.reactiveNestedObject.addressSchema": "住所",
  "formDemo.reactiveNestedObject.emergencyContactSchema.name": "氏名",
  "formDemo.reactiveNestedObject.emergencyContactSchema.phone": "電話番号",
  "formDemo.reactiveNestedObject.emergencyContactSchema.relationship": "続柄",
  "formDemo.reactiveNestedObject.emergencyContactSchema": "緊急連絡先",
  "formDemo.reactiveNestedObject.fullName": "氏名",
  "formDemo.reactiveNestedObject.email.email":
    "有効なメールアドレスを入力してください",
  "formDemo.reactiveNestedObject.email": "メールアドレス",
  "formDemo.reactiveNestedObject.phone": "電話番号",
  "formDemo.reactiveNestedObject.root": "会員",
  "formDemo.reactiveNestedObject.message.compute":
    "Reactive版ではネストオブジェクトの各フィールドに確認UIが付きます。",
} satisfies MessagesOf<typeof en>;
