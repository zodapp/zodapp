import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（basicInput） */
export const en = defineMessages({
  "formDemo.page.basicInput.title": "Basics",
  "formDemo.page.basicInput.description":
    "Basic input of strings, numbers, booleans, dates, and BigInt",
  "formDemo.basicInput.firstName": "First name (string)",
  "formDemo.basicInput.lastName": "Last name (string, required)",
  "formDemo.basicInput.frequency": "Drinking days per week (number, slider)",
  "formDemo.basicInput.age": "Age (number)",
  "formDemo.basicInput.birthday": "Birthday (date)",
  "formDemo.basicInput.isMember": "Member (boolean)",
  "formDemo.basicInput.favoriteColor": "Fixed data (literal)",
  "formDemo.basicInput.isConfirmed.literal": "Please approve",
  "formDemo.basicInput.isConfirmed":
    "Approved (literal type + forced boolean component)",
  "formDemo.basicInput.position": "Coordinates (tuple)",
  "formDemo.basicInput.message.compute":
    "This is a sample of a basic input form",
});
