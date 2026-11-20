import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（literalUnionSelect） */
export const en = defineMessages({
  "formDemo.page.literalUnionSelect.description":
    'With uiType: "select" or "badge" on a union of only literals, you can choose with the same component as enum. Every value a literal can hold (string, number, bigint, boolean, null, undefined) can be chosen, and literal(10) and literal("10") are distinguished. Arms of z.null() and z.undefined() can also be chosen, and the arms take precedence when combined with optional or nullable. With uiType: "multipleEnum" or "multipleEnumBadge" on an array, you can choose several',
});
