import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

/** form-demo の日本語の辞書 */
export const ja = {
  "formDemo.i18n.name": "名前",
  "formDemo.i18n.nameTooShort": ({ length }) =>
    `${length}文字以上で入力してください。`,
  "formDemo.i18n.email": "メールアドレス",
  "formDemo.i18n.color": "好きな色",
  "formDemo.i18n.color.red": "赤",
  "formDemo.i18n.color.green": "緑",
  "formDemo.i18n.color.blue": "青",
  "formDemo.i18n.contact": "連絡方法",
  "formDemo.i18n.contact.selector": "連絡の手段",
  "formDemo.i18n.contact.email": "メール",
  "formDemo.i18n.contact.phone": "電話",
  "formDemo.i18n.phone": "電話番号",
  "formDemo.i18n.birthday": "誕生日",
  "formDemo.i18n.note": "メモ",
} satisfies MessagesOf<typeof en>;
