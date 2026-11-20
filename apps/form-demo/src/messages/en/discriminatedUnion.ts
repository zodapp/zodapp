import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（discriminatedUnion） */
export const en = defineMessages({
  "formDemo.page.discriminatedUnion.description":
    "A stable union using a discriminated key. When you switch the type, fields shared between types (contact name, notes) are kept, fields only in the previous type are removed, and the new type's default values are filled in. Switching back does not restore the previous values. The select field (channel) of a type that is not selected keeps its value even when the options change",
  "formDemo.discriminatedUnion.contactSchema.email.email.email":
    "Enter a valid email address",
  "formDemo.discriminatedUnion.contactSchema.email.email": "Email",
  "formDemo.discriminatedUnion.contactSchema.email.note": "Notes",
  "formDemo.discriminatedUnion.contactSchema.email": "Contact by email",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType.mobile":
    "Mobile phone",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType.landline":
    "Landline",
  "formDemo.discriminatedUnion.contactSchema.phone.phoneType": "Phone type",
  "formDemo.discriminatedUnion.contactSchema.phone.phone": "Phone number",
  "formDemo.discriminatedUnion.contactSchema.phone.note": "Notes",
  "formDemo.discriminatedUnion.contactSchema.phone": "Contact by phone",
  "formDemo.discriminatedUnion.contactSchema": "Contact",
  "formDemo.discriminatedUnion.contactSchema.selectorLabel": "Contact type",
  "formDemo.discriminatedUnion.legacyContactSchema":
    "Contact (a union wrapped in z.preprocess; the initial value is in an old form without type)",
  "formDemo.discriminatedUnion.legacyContactSchema.selectorLabel":
    "Contact type",
  "formDemo.discriminatedUnion.deskCommon.name": "Name",
  "formDemo.discriminatedUnion.deskCommon.note": "Notes",
  "formDemo.discriminatedUnion.deskSchema.store.address": "Address",
  "formDemo.discriminatedUnion.deskSchema.store": "Store",
  "formDemo.discriminatedUnion.deskSchema.online.channel": "Channel",
  "formDemo.discriminatedUnion.deskSchema.online": "Online",
  "formDemo.discriminatedUnion.deskSchema": "Desk (types share common fields)",
  "formDemo.discriminatedUnion.deskSchema.selectorLabel": "Desk type",
  "formDemo.discriminatedUnion.message.compute":
    "A discriminated union tells types apart by a discriminator (type). It performs better and is easier to maintain than a plain union.",
  "formDemo.discriminatedUnion.try.description":
    "Re-deliver the channel options of the online desk. While the store is selected, the channel field is not drawn, so its value is not removed",
  "formDemo.discriminatedUnion.try.removeChat": "Remove chat from the options",
  "formDemo.discriminatedUnion.try.restore": "Restore options",
});
