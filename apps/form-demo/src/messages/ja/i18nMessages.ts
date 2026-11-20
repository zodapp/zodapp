import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/i18nMessages";

/** form-demo の日本語の辞書（i18nMessages） */
export const ja = {
  "formDemo.page.i18nMessages.description":
    "meta の文言と zod のエラーを辞書のキーで書く。ヘッダーで言語を切り替えると、ラベル・選択肢・エラー・日付の表示が変わる",
  "formDemo.i18nMessages.name": "名前",
  "formDemo.i18nMessages.nameTooShort": ({ length }) =>
    `${length}文字以上で入力してください。`,
  "formDemo.i18nMessages.email": "メールアドレス",
  "formDemo.i18nMessages.color": "好きな色",
  "formDemo.i18nMessages.color.red": "赤",
  "formDemo.i18nMessages.color.green": "緑",
  "formDemo.i18nMessages.color.blue": "青",
  "formDemo.i18nMessages.contact": "連絡方法",
  "formDemo.i18nMessages.contact.selector": "連絡の手段",
  "formDemo.i18nMessages.contact.email": "メール",
  "formDemo.i18nMessages.contact.phone": "電話",
  "formDemo.i18nMessages.phone": "電話番号",
  "formDemo.i18nMessages.birthday": "誕生日",
  "formDemo.i18nMessages.note": "メモ",
  "formDemo.i18nMessages.message.compute":
    "ラベル・選択肢・エラーは辞書のキーで書いています。ヘッダーで English に切り替えると、英語の辞書で表示します。送信すると、名前（params 付きのキー）とメールアドレス（zod の既定のエラー）のエラーが出ます。",
} satisfies MessagesOf<typeof en>;
