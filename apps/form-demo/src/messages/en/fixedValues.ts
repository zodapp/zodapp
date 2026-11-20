import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（fixedValues） */
export const en = defineMessages({
  "formDemo.page.fixedValues.title": "Fixed values (hidden: false)",
  "formDemo.page.fixedValues.description":
    "Types with exactly one value (a literal with one value, z.null(), and so on) show no field by default and only set the value. With hidden: false in the meta, the value is shown like readOnly (without the required mark). In both cases the submitted value contains the fixed value. z.null() has no content, so it is not shown even with hidden: false",
});
