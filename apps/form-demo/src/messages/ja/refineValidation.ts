import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/refineValidation";

/** form-demo の日本語の辞書（refineValidation） */
export const ja = {
  "formDemo.page.refineValidation.description":
    "refineを使ったパスワード一致などのカスタムバリデーション",
  "formDemo.refineValidation.username.min": "ユーザー名は3文字以上必要です",
  "formDemo.refineValidation.username": "ユーザー名",
  "formDemo.refineValidation.email.email":
    "有効なメールアドレスを入力してください",
  "formDemo.refineValidation.email": "メールアドレス",
  "formDemo.refineValidation.password.min": "パスワードは8文字以上必要です",
  "formDemo.refineValidation.password": "パスワード",
  "formDemo.refineValidation.confirmPassword": "パスワード（確認）",
  "formDemo.refineValidation.refine": "パスワードが一致しません",
  "formDemo.refineValidation.message.compute":
    "refineを使用すると、複数フィールドにまたがるカスタムバリデーション（パスワード一致確認など）を実装できます。whenオプションでバリデーション条件の指定も可能です。",
} satisfies MessagesOf<typeof en>;
