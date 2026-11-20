import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（validatePreceding） */
export const en = defineMessages({
  "formDemo.page.validatePreceding.title":
    "Validating preceding fields together",
  "formDemo.page.validatePreceding.description":
    "When a later field gets focus, validate the empty fields before it together (the behavior of ValidatePrecedingFieldsProvider built into AutoForm)",
});
