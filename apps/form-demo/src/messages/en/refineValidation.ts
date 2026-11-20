import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（refineValidation） */
export const en = defineMessages({
  "formDemo.page.refineValidation.description":
    "Custom validation with refine, such as matching passwords",
  "formDemo.refineValidation.username.min":
    "The username must be at least 3 characters",
  "formDemo.refineValidation.username": "Username",
  "formDemo.refineValidation.email.email": "Enter a valid email address",
  "formDemo.refineValidation.email": "Email address",
  "formDemo.refineValidation.password.min":
    "The password must be at least 8 characters",
  "formDemo.refineValidation.password": "Password",
  "formDemo.refineValidation.confirmPassword": "Password (confirmation)",
  "formDemo.refineValidation.refine": "The passwords do not match",
  "formDemo.refineValidation.message.compute":
    "refine lets you implement custom validation across multiple fields (such as matching passwords). The when option can specify when to validate.",
});
