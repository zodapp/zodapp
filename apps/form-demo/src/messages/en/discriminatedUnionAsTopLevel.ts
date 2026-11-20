import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（discriminatedUnionAsTopLevel） */
export const en = defineMessages({
  "formDemo.page.discriminatedUnionAsTopLevel.title":
    "z.discriminatedUnion (top level)",
  "formDemo.page.discriminatedUnionAsTopLevel.description":
    "Use a union with a discriminated key directly as the top-level schema",
  "formDemo.discriminatedUnionAsTopLevel.email.email.email":
    "Enter a valid email address",
  "formDemo.discriminatedUnionAsTopLevel.email.email": "Email",
  "formDemo.discriminatedUnionAsTopLevel.email.note": "Notes",
  "formDemo.discriminatedUnionAsTopLevel.email": "Contact by email",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.mobile":
    "Mobile phone",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType.landline": "Landline",
  "formDemo.discriminatedUnionAsTopLevel.phone.phoneType": "Phone type",
  "formDemo.discriminatedUnionAsTopLevel.phone.phone": "Phone number",
  "formDemo.discriminatedUnionAsTopLevel.phone.note": "Notes",
  "formDemo.discriminatedUnionAsTopLevel.phone": "Contact by phone",
  "formDemo.discriminatedUnionAsTopLevel.root": "Contact",
  "formDemo.discriminatedUnionAsTopLevel.selectorLabel": "Contact type",
});
