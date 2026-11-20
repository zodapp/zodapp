import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（reactiveReadOnly） */
export const en = defineMessages({
  "formDemo.page.reactiveReadOnly.title": "Read-only display (Reactive)",
  "formDemo.page.reactiveReadOnly.description":
    "readOnly mode with reactiveComponentLibrary. Unsupported types (bigint, tuple, array, discriminatedUnion) are left out.",
});
