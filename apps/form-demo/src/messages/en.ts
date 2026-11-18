import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（型の基準）。多言語化のデモページ（i18nMessages）で使う */
export const en = defineMessages({
  "formDemo.i18n.name": "Name",
  "formDemo.i18n.nameTooShort": ({ length }: { length: string }) =>
    `Enter at least ${length} characters.`,
  "formDemo.i18n.email": "Email",
  "formDemo.i18n.color": "Favorite color",
  "formDemo.i18n.color.red": "Red",
  "formDemo.i18n.color.green": "Green",
  "formDemo.i18n.color.blue": "Blue",
  "formDemo.i18n.contact": "Contact by",
  "formDemo.i18n.contact.selector": "Contact method",
  "formDemo.i18n.contact.email": "Email",
  "formDemo.i18n.contact.phone": "Phone",
  "formDemo.i18n.phone": "Phone number",
  "formDemo.i18n.birthday": "Birthday",
  "formDemo.i18n.note": "Notes",
});
