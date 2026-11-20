import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（reactiveReadOnly） */
export const en = defineMessages({
  "formDemo.page.reactiveReadOnly.title": "Read-only display (Reactive)",
  "formDemo.page.reactiveReadOnly.description":
    "readOnly mode with reactiveComponentLibrary. Unsupported types (bigint, tuple, array, discriminatedUnion) are left out.",
  "formDemo.reactiveReadOnly.hobbyLiterals.reading": "Reading",
  "formDemo.reactiveReadOnly.hobbyLiterals.sports": "Sports",
  "formDemo.reactiveReadOnly.hobbyLiterals.music": "Music",
  "formDemo.reactiveReadOnly.hobbyLiterals.gaming": "Games",
  "formDemo.reactiveReadOnly.firstName": "First name (string)",
  "formDemo.reactiveReadOnly.lastName": "Last name (string, required)",
  "formDemo.reactiveReadOnly.frequency":
    "Drinking days per week (number, slider)",
  "formDemo.reactiveReadOnly.age": "Age (number)",
  "formDemo.reactiveReadOnly.birthday": "Birthday (date)",
  "formDemo.reactiveReadOnly.isMember": "Member (boolean)",
  "formDemo.reactiveReadOnly.favoriteColor": "Fixed data (literal)",
  "formDemo.reactiveReadOnly.isConfirmed.literal": "Please approve",
  "formDemo.reactiveReadOnly.isConfirmed":
    "Approved (literal type + forced boolean component)",
  "formDemo.reactiveReadOnly.favoriteHobby": "Favorite hobby (enum)",
  "formDemo.reactiveReadOnly.message.compute":
    "This is a sample of the Reactive readOnly mode",
});
