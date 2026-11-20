import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（externalKeyFilter） */
export const en = defineMessages({
  "formDemo.page.externalKeyFilter.title": "zf.externalKey (filtering)",
  "formDemo.page.externalKeyFilter.description":
    'Filter a list by the signed-in user\'s department and so on. The list is fetched again when the condition changes. A value that drops out is cleared (clear) or kept with the error "(Invalid value)" (keep). Multi-select fields work the same way. In "Try it", choose when fetches arrive, make them fail, set the options to 0 items and back on the same subscription, and show a field with a missing topic',
});
