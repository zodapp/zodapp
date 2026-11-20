import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（i18nMessages） */
export const en = defineMessages({
  "formDemo.page.i18nMessages.description":
    "Write meta texts and zod errors as dictionary keys. Switching the language in the header changes the labels, options, errors, and date display",
  "formDemo.i18nMessages.name": "Name",
  "formDemo.i18nMessages.nameTooShort": ({ length }: { length: string }) =>
    `Enter at least ${length} characters.`,
  "formDemo.i18nMessages.email": "Email",
  "formDemo.i18nMessages.color": "Favorite color",
  "formDemo.i18nMessages.color.red": "Red",
  "formDemo.i18nMessages.color.green": "Green",
  "formDemo.i18nMessages.color.blue": "Blue",
  "formDemo.i18nMessages.contact": "Contact by",
  "formDemo.i18nMessages.contact.selector": "Contact method",
  "formDemo.i18nMessages.contact.email": "Email",
  "formDemo.i18nMessages.contact.phone": "Phone",
  "formDemo.i18nMessages.phone": "Phone number",
  "formDemo.i18nMessages.birthday": "Birthday",
  "formDemo.i18nMessages.note": "Notes",
  "formDemo.i18nMessages.message.compute":
    "Labels, options, and errors are written as dictionary keys. Switching to 日本語 in the header shows them with the Japanese dictionary. Submitting shows errors for the name (a key with params) and the email address (zod's default error).",
});
