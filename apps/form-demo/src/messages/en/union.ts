import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（union） */
export const en = defineMessages({
  "formDemo.page.union.description":
    "Enter either a phone number or an email address",
  "formDemo.union.contact.arm0.email": "Enter a valid email address",
  "formDemo.union.contact.arm0": "Email address (string)",
  "formDemo.union.contact.phone.phoneType.mobile": "Mobile phone",
  "formDemo.union.contact.phone.phoneType.landline": "Landline",
  "formDemo.union.contact.phone.phoneType": "Phone type",
  "formDemo.union.contact.phone.phone": "Phone number",
  "formDemo.union.contact.phone": "Phone",
  "formDemo.union.contact.address.address": "Address",
  "formDemo.union.contact.address": "Address",
  "formDemo.union.contact": "Contact",
  "formDemo.union.contact.selectorLabel": "Contact type",
  "formDemo.union.message.compute":
    "A union lets you choose one of options of different types and enter it. Choose email, phone, or address.",
});
