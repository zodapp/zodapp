import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（discriminatedUnion） */
export const en = defineMessages({
  "formDemo.page.discriminatedUnion.description":
    "A stable union using a discriminated key. When you switch the type, fields shared between types (contact name, notes) are kept, fields only in the previous type are removed, and the new type's default values are filled in. Switching back does not restore the previous values. The select field (channel) of a type that is not selected keeps its value even when the options change",
});
