import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/dynamicSchema";

/** form-demo の日本語の辞書（dynamicSchema） */
export const ja = {
  "formDemo.page.dynamicSchema.description":
    "入力内容でスキーマを切り替える（通知方法ごとの設定項目）。決まったスキーマの既定値（.default()）は、値が無いところに補う（開いたときの「本文の形式」、Webhook に切り替えたときの「再試行の回数」）",
  "formDemo.dynamicSchema.typeField.email": "メール",
  "formDemo.dynamicSchema.typeField": "通知方法",
  "formDemo.dynamicSchema.notificationSchemas.email.to": "宛先",
  "formDemo.dynamicSchema.notificationSchemas.email.subject": "件名",
  "formDemo.dynamicSchema.notificationSchemas.email.format.text": "テキスト",
  "formDemo.dynamicSchema.notificationSchemas.email.format": "本文の形式",
  "formDemo.dynamicSchema.notificationSchemas.slack.channel":
    "チャンネル（#general など）",
  "formDemo.dynamicSchema.notificationSchemas.slack.mention":
    "@channel メンション",
  "formDemo.dynamicSchema.notificationSchemas.webhook.retries": "再試行の回数",
  "formDemo.dynamicSchema.notificationSchemas.webhook.secret":
    "署名シークレット",
  "formDemo.dynamicSchema.name": "ルール名",
  "formDemo.dynamicSchema.notification": "通知設定",
} satisfies MessagesOf<typeof en>;
