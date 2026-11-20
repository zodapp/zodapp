import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/dynamicSchema";

/** form-demo の日本語の辞書（dynamicSchema） */
export const ja = {
  "formDemo.page.dynamicSchema.description":
    "入力内容でスキーマを切り替える（通知方法ごとの設定項目）。決まったスキーマの既定値（.default()）は、値が無いところに補う（開いたときの「本文の形式」、Webhook に切り替えたときの「再試行の回数」）",
} satisfies MessagesOf<typeof en>;
