import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eMisc） */
export const en = defineMessages({
  "formDemo.page.e2eMisc.title": "e2e: other ways to write types",
  "formDemo.page.e2eMisc.description":
    "An object-shaped enum uses its keys as option names and writes the value when selected. z.coerce.date() can be passed to zf.date. z.email() can be the base of an external key (values that do not match are errors). A literal with multiple values can be the element of multipleEnum",
  "formDemo.e2eMisc.size": "Size (object-shaped enum)",
  "formDemo.e2eMisc.dueDate": "Due date (z.coerce.date())",
  "formDemo.e2eMisc.contactEmail": "Contact email (externalKey + z.email())",
  "formDemo.e2eMisc.colors": "Colors (multiple literal values × multipleEnum)",
});
