import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/discriminatedUnionAsTopLevel";

/** form-demo の日本語の辞書（discriminatedUnionAsTopLevel） */
export const ja = {
  "formDemo.page.discriminatedUnionAsTopLevel.title":
    "z.discriminatedUnion（トップレベル）",
  "formDemo.page.discriminatedUnionAsTopLevel.description":
    "discriminated keyを使ったUnionをトップレベルスキーマとして直接使用する例",
  "formDemo.discriminatedUnionAsTopLevel.email.email.email":
    "有効なメールアドレスを入力してください",
  "formDemo.discriminatedUnionAsTopLevel.email.email": "メール",
  "formDemo.discriminatedUnionAsTopLevel.email.note": "備考",
  "formDemo.discriminatedUnionAsTopLevel.email": "メール連絡",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.mobile": "携帯電話",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.landline": "固定電話",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType": "電話番号タイプ",
  "formDemo.discriminatedUnionAsTopLevel.phone.phone": "電話番号",
  "formDemo.discriminatedUnionAsTopLevel.phone.note": "備考",
  "formDemo.discriminatedUnionAsTopLevel.phone": "電話連絡",
  "formDemo.discriminatedUnionAsTopLevel.root": "連絡先",
  "formDemo.discriminatedUnionAsTopLevel.selectorLabel": "連絡先タイプ",
} satisfies MessagesOf<typeof en>;
