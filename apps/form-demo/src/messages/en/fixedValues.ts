import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（fixedValues） */
export const en = defineMessages({
  "formDemo.page.fixedValues.title": "Fixed values (hidden: false)",
  "formDemo.page.fixedValues.description":
    "Types with exactly one value (a literal with one value, z.null(), and so on) show no field by default and only set the value. With hidden: false in the meta, the value is shown like readOnly (without the required mark). In both cases the submitted value contains the fixed value. z.null() has no content, so it is not shown even with hidden: false",
  "formDemo.fixedValues.article.kind": "Kind",
  "formDemo.fixedValues.article.version": "Version",
  "formDemo.fixedValues.article.title": "Title",
  "formDemo.fixedValues.article.deletedAt": "Deleted at",
  "formDemo.fixedValues.article.contact.email.type": "Contact kind",
  "formDemo.fixedValues.article.contact.email.email": "Email",
  "formDemo.fixedValues.article.contact.email": "Email",
  "formDemo.fixedValues.article.contact.phone.type": "Contact kind",
  "formDemo.fixedValues.article.contact.phone.phone": "Phone number",
  "formDemo.fixedValues.article.contact.phone": "Phone",
  "formDemo.fixedValues.article.contact": "Contact",
  "formDemo.fixedValues.article.contact.selectorLabel":
    "How to choose the contact",
  "formDemo.fixedValues.article.shown": "hidden: false (show fixed values)",
  "formDemo.fixedValues.article.hidden": "Default (fixed values are not shown)",
});
