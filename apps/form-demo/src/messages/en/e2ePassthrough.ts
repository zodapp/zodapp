import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2ePassthrough） */
export const en = defineMessages({
  "formDemo.page.e2ePassthrough.title": "e2e: types sent as is without a field",
  "formDemo.page.e2ePassthrough.description":
    "z.any(), z.unknown(), z.custom(), z.symbol(), z.function(), z.never() (optional), and z.nan() show no field and send the initial value as is. z.templateLiteral() becomes a string field and is an error when the value does not match. .nonoptional() draws the inner field, and submission stops when it is empty",
  "formDemo.e2ePassthrough.title": "Heading",
  "formDemo.e2ePassthrough.anyValue": "any value",
  "formDemo.e2ePassthrough.unknownValue": "unknown value",
  "formDemo.e2ePassthrough.customValue": "custom value",
  "formDemo.e2ePassthrough.symbolValue": "symbol value",
  "formDemo.e2ePassthrough.callback": "function value",
  "formDemo.e2ePassthrough.nothing": "never value",
  "formDemo.e2ePassthrough.notANumber": "nan value",
  "formDemo.e2ePassthrough.userId": "User ID (templateLiteral)",
  "formDemo.e2ePassthrough.memo": "Memo (nonoptional)",
});
