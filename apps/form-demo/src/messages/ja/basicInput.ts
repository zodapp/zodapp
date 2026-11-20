import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/basicInput";

/** form-demo の日本語の辞書（basicInput） */
export const ja = {
  "formDemo.page.basicInput.title": "基本",
  "formDemo.page.basicInput.description":
    "文字列、数値、真偽値、日付、BigIntの基本的な入力",
} satisfies MessagesOf<typeof en>;
