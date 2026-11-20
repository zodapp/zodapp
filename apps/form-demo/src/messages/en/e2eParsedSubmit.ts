import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eParsedSubmit） */
export const en = defineMessages({
  "formDemo.page.e2eParsedSubmit.title": "e2e: converting submitted values",
  "formDemo.page.e2eParsedSubmit.description":
    "onSubmit receives the parsed value (z.output). The name is trimmed, the code is uppercased, the number (codec) becomes a number, the consent (stringbool) becomes true / false, and the abbreviation becomes n/a if shorter than 3 characters. The role (default) and the nickname (prefault) are filled with defaults when opened, and isDirty stays false just after opening",
  "formDemo.e2eParsedSubmit.name": "Name (trim)",
  "formDemo.e2eParsedSubmit.role": "Role (default)",
  "formDemo.e2eParsedSubmit.nickname": "Nickname (prefault)",
  "formDemo.e2eParsedSubmit.count": "Count (coerce)",
  "formDemo.e2eParsedSubmit.code": "Code (uppercased with pipe)",
  "formDemo.e2eParsedSubmit.amount": "Number (codec)",
  "formDemo.e2eParsedSubmit.agree": "Consent (stringbool)",
  "formDemo.e2eParsedSubmit.shortName": "Abbreviation (catch)",
});
