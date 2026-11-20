import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eOpenRewrite） */
export const en = defineMessages({
  "formDemo.page.e2eOpenRewrite.title": "e2e: what opening the form rewrites",
  "formDemo.page.e2eOpenRewrite.description":
    "When opened, a clear field whose initial value is not in the options loses the value, and a keep field keeps it and shows an error. A preprocess union whose initial value is in an old form without type gets the type filled in. A precision field keeps its initial value. In all cases isDirty is false just after opening, and becomes true after editing one field",
});
