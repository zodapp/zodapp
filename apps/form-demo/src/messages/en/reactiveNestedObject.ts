import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（reactiveNestedObject） */
export const en = defineMessages({
  "formDemo.page.reactiveNestedObject.description":
    "Nested objects with reactiveComponentLibrary, with a confirmation UI per field.",
  "formDemo.reactiveNestedObject.addressSchema.postalCode": "ZIP code",
  "formDemo.reactiveNestedObject.addressSchema.prefecture": "State",
  "formDemo.reactiveNestedObject.addressSchema.city": "City",
  "formDemo.reactiveNestedObject.addressSchema.street": "Street",
  "formDemo.reactiveNestedObject.addressSchema": "Address",
  "formDemo.reactiveNestedObject.emergencyContactSchema.name": "Name",
  "formDemo.reactiveNestedObject.emergencyContactSchema.phone": "Phone number",
  "formDemo.reactiveNestedObject.emergencyContactSchema.relationship":
    "Relationship",
  "formDemo.reactiveNestedObject.emergencyContactSchema": "Emergency contact",
  "formDemo.reactiveNestedObject.fullName": "Full name",
  "formDemo.reactiveNestedObject.email.email": "Enter a valid email address",
  "formDemo.reactiveNestedObject.email": "Email address",
  "formDemo.reactiveNestedObject.phone": "Phone number",
  "formDemo.reactiveNestedObject.root": "Member",
  "formDemo.reactiveNestedObject.message.compute":
    "In the Reactive version, each field of a nested object has a confirmation UI.",
});
