import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/union";

/** form-demo の日本語の辞書（union） */
export const ja = {
  "formDemo.page.union.description":
    "電話番号かメールアドレスのどちらかを入力する",
} satisfies MessagesOf<typeof en>;
