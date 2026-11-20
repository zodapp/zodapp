import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eUnsupported） */
export const en = defineMessages({
  "formDemo.page.e2eUnsupported.title": "e2e: notes for unsupported types",
  "formDemo.page.e2eUnsupported.description":
    'A tuple with rest, an array whose uiType does not match the element type, and a set of objects show the note "Not supported" in place of the field, and the other fields are drawn. A key name that cannot be used (containing .) shows "This key name cannot be used", and such keys saved in a record are shown as rows that cannot be edited. Because of z.promise() and an async refine, submission stops and the reason is shown',
});
