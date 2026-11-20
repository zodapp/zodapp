import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（readOnly） */
export const en = defineMessages({
  "formDemo.page.readOnly.title": "Read-only display",
  "formDemo.page.readOnly.description": "readOnly mode",
  "formDemo.readOnly.hobbyLiterals.reading": "Reading",
  "formDemo.readOnly.hobbyLiterals.sports": "Sports",
  "formDemo.readOnly.hobbyLiterals.music": "Music",
  "formDemo.readOnly.hobbyLiterals.gaming": "Games",
  "formDemo.readOnly.contactSchema.email.email.email":
    "Enter a valid email address",
  "formDemo.readOnly.contactSchema.email.email": "Email",
  "formDemo.readOnly.contactSchema.email": "Contact by email",
  "formDemo.readOnly.contactSchema.phone.phone": "Phone number",
  "formDemo.readOnly.contactSchema.phone": "Contact by phone",
  "formDemo.readOnly.contactSchema": "Contact",
  "formDemo.readOnly.contactSchema.selectorLabel": "Contact type",
  "formDemo.readOnly.firstName": "First name (string)",
  "formDemo.readOnly.lastName": "Last name (string, required)",
  "formDemo.readOnly.frequency": "Drinking days per week (number, slider)",
  "formDemo.readOnly.age": "Age (number)",
  "formDemo.readOnly.birthday": "Birthday (date)",
  "formDemo.readOnly.isMember": "Member (boolean)",
  "formDemo.readOnly.favoriteColor": "Fixed data (literal)",
  "formDemo.readOnly.isConfirmed.literal": "Please approve",
  "formDemo.readOnly.isConfirmed":
    "Approved (literal type + forced boolean component)",
  "formDemo.readOnly.position": "Coordinates (tuple)",
  "formDemo.readOnly.favoriteHobby": "Favorite hobby (enum)",
  "formDemo.readOnly.hobbies": "Hobbies (array enum)",
  "formDemo.readOnly.message.compute": "This is a sample of readOnly mode",
});
