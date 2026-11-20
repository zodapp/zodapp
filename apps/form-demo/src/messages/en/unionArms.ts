import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（unionArms） */
export const en = defineMessages({
  "formDemo.page.unionArms.title": "zf.union (various arms)",
  "formDemo.page.unionArms.description":
    "Mix string, number, boolean, option, literal, and object arms in a union without a discriminator. The chosen arm is remembered, and the value is written in that arm's type (a number for the number arm). A value that passes both arms stays in the chosen arm. When the value changes from outside and no longer passes the current arm, it switches to an arm that passes",
});
