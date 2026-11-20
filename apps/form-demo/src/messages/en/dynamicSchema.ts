import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（dynamicSchema） */
export const en = defineMessages({
  "formDemo.page.dynamicSchema.description":
    'Switch the schema by the input (settings for each notification method). Defaults of a fixed schema (.default()) fill in where there is no value ("Body format" when opened, "Retry count" when switching to Webhook)',
  "formDemo.dynamicSchema.typeField.email": "Email",
  "formDemo.dynamicSchema.typeField": "Notification method",
  "formDemo.dynamicSchema.notificationSchemas.email.to": "To",
  "formDemo.dynamicSchema.notificationSchemas.email.subject": "Subject",
  "formDemo.dynamicSchema.notificationSchemas.email.format.text": "Text",
  "formDemo.dynamicSchema.notificationSchemas.email.format": "Body format",
  "formDemo.dynamicSchema.notificationSchemas.slack.channel":
    "Channel (#general, etc.)",
  "formDemo.dynamicSchema.notificationSchemas.slack.mention":
    "@channel mention",
  "formDemo.dynamicSchema.notificationSchemas.webhook.retries": "Retry count",
  "formDemo.dynamicSchema.notificationSchemas.webhook.secret": "Signing secret",
  "formDemo.dynamicSchema.name": "Rule name",
  "formDemo.dynamicSchema.notification": "Notification settings",
});
