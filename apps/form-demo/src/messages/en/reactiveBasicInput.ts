import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（reactiveBasicInput） */
export const en = defineMessages({
  "formDemo.page.reactiveBasicInput.title": "Basics (Reactive)",
  "formDemo.page.reactiveBasicInput.description":
    "Basic input with reactiveComponentLibrary, with a confirmation UI per field.",
  "formDemo.reactiveBasicInput.firstName": "First name (string)",
  "formDemo.reactiveBasicInput.lastName": "Last name (string, required)",
  "formDemo.reactiveBasicInput.note": "Memo (string, multiline)",
  "formDemo.reactiveBasicInput.frequency":
    "Drinking days per week (number, slider)",
  "formDemo.reactiveBasicInput.age": "Age (number)",
  "formDemo.reactiveBasicInput.birthday": "Birthday (date)",
  "formDemo.reactiveBasicInput.isMember": "Member (boolean)",
  "formDemo.reactiveBasicInput.favoriteColor": "Fixed data (literal)",
  "formDemo.reactiveBasicInput.isConfirmed.literal": "Please approve",
  "formDemo.reactiveBasicInput.isConfirmed":
    "Approved (literal type + forced boolean component)",
  "formDemo.reactiveBasicInput.message.compute":
    "This is a sample of the Reactive basic input form",
});
