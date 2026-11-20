import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（validatePreceding） */
export const en = defineMessages({
  "formDemo.page.validatePreceding.title":
    "Validating preceding fields together",
  "formDemo.page.validatePreceding.description":
    "When a later field gets focus, validate the empty fields before it together (the behavior of ValidatePrecedingFieldsProvider built into AutoForm)",
  "formDemo.validatePreceding.name.min": "Enter your name",
  "formDemo.validatePreceding.name": "Name (required)",
  "formDemo.validatePreceding.email.min": "Enter your email address",
  "formDemo.validatePreceding.email": "Email address (required)",
  "formDemo.validatePreceding.tel.min": "Enter your phone number",
  "formDemo.validatePreceding.tel": "Phone number (required)",
  "formDemo.validatePreceding.note": "Notes (optional)",
});
