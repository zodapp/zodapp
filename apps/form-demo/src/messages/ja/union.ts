import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/union";

/** form-demo の日本語の辞書（union） */
export const ja = {
  "formDemo.page.union.description":
    "電話番号かメールアドレスのどちらかを入力する",
  "formDemo.union.contact.arm0.email": "有効なメールアドレスを入力してください",
  "formDemo.union.contact.arm0": "メールアドレス(文字列)",
  "formDemo.union.contact.phone.phoneType.mobile": "携帯電話",
  "formDemo.union.contact.phone.phoneType.landline": "固定電話",
  "formDemo.union.contact.phone.phoneType": "電話番号タイプ",
  "formDemo.union.contact.phone.phone": "電話番号",
  "formDemo.union.contact.phone": "電話",
  "formDemo.union.contact.address.address": "住所",
  "formDemo.union.contact.address": "住所",
  "formDemo.union.contact": "連絡先",
  "formDemo.union.contact.selectorLabel": "連絡先タイプ",
  "formDemo.union.message.compute":
    "Union型では、異なる型の選択肢から1つを選んで入力できます。メール、電話、住所のいずれかを選択してください。",
} satisfies MessagesOf<typeof en>;
