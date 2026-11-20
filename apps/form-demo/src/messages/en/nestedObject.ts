import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（nestedObject） */
export const en = defineMessages({
  "formDemo.page.nestedObject.description":
    "A combination of plain fields and nested objects",
  "formDemo.nestedObject.addressSchema.postalCode": "ZIP code",
  "formDemo.nestedObject.addressSchema.prefecture": "State",
  "formDemo.nestedObject.addressSchema.city": "City",
  "formDemo.nestedObject.addressSchema.street": "Street",
  "formDemo.nestedObject.addressSchema": "Address",
  "formDemo.nestedObject.emergencyContactSchema.name": "Name",
  "formDemo.nestedObject.emergencyContactSchema.phone": "Phone number",
  "formDemo.nestedObject.emergencyContactSchema.relationship": "Relationship",
  "formDemo.nestedObject.emergencyContactSchema": "Emergency contact",
  "formDemo.nestedObject.fullName": "Full name",
  "formDemo.nestedObject.email.email": "Enter a valid email address",
  "formDemo.nestedObject.email": "Email address",
  "formDemo.nestedObject.phone": "Phone number",
  "formDemo.nestedObject.root": "Member",
  "formDemo.nestedObject.message.compute":
    "Nested objects can be expressed as a form as they are.",
});
