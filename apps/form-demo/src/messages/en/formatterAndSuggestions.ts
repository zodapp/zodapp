import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（formatterAndSuggestions） */
export const en = defineMessages({
  "formDemo.page.formatterAndSuggestions.description":
    "Input suggestions, and formatting values shown in readOnly",
  "formDemo.formatterAndSuggestions.company":
    "Company name (suggestions: string[])",
  "formDemo.formatterAndSuggestions.prefecture":
    "State (suggestions: {label, value}[])",
  "formDemo.formatterAndSuggestions.phone":
    "Phone number (formatter, formatted in readOnly)",
  "formDemo.formatterAndSuggestions.amount":
    "Amount (number formatter, formatted in readOnly)",
  "formDemo.formatterAndSuggestions.status":
    "Status (formatter returns a badge)",
});
