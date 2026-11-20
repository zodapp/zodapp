import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（date） */
export const en = defineMessages({
  "formDemo.page.date.description":
    "Date and time input (various Zod types, granularities, and encodings). Opening the form does not rewrite values; editing writes the form decided by precision and unit. In a field whose unit is coarser than the saved value, editing sets the finer parts to 0",
});
