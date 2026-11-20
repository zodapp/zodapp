import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（dynamicSchema） */
export const en = defineMessages({
  "formDemo.page.dynamicSchema.description":
    'Switch the schema by the input (settings for each notification method). Defaults of a fixed schema (.default()) fill in where there is no value ("Body format" when opened, "Retry count" when switching to Webhook)',
});
