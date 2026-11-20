import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/nestedObject";

/** form-demo の日本語の辞書（nestedObject） */
export const ja = {
  "formDemo.page.nestedObject.description":
    "通常フィールドとネストしたオブジェクトの組み合わせ",
  "formDemo.nestedObject.addressSchema.postalCode": "ZIP コード",
  "formDemo.nestedObject.addressSchema.prefecture": "州",
  "formDemo.nestedObject.addressSchema.city": "市",
  "formDemo.nestedObject.addressSchema.street": "番地",
  "formDemo.nestedObject.addressSchema": "住所",
  "formDemo.nestedObject.emergencyContactSchema.name": "氏名",
  "formDemo.nestedObject.emergencyContactSchema.phone": "電話番号",
  "formDemo.nestedObject.emergencyContactSchema.relationship": "続柄",
  "formDemo.nestedObject.emergencyContactSchema": "緊急連絡先",
  "formDemo.nestedObject.fullName": "氏名",
  "formDemo.nestedObject.email.email": "有効なメールアドレスを入力してください",
  "formDemo.nestedObject.email": "メールアドレス",
  "formDemo.nestedObject.phone": "電話番号",
  "formDemo.nestedObject.root": "会員",
  "formDemo.nestedObject.message.compute":
    "ネストしたオブジェクトをそのままフォームとして表現できます。",
} satisfies MessagesOf<typeof en>;
