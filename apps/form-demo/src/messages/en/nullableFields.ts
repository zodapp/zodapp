import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（nullableFields） */
export const en = defineMessages({
  "formDemo.page.nullableFields.description":
    "The value written when a field is emptied: null for a nullable-only field (not a required error; it can be submitted empty), and undefined for an optional field (including one that is both optional and nullable). A nullable object starts as null, opens with +, and returns to null with delete",
});
