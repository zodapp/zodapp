import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（literalUnionSelect） */
export const en = defineMessages({
  "formDemo.page.literalUnionSelect.description":
    'With uiType: "select" or "badge" on a union of only literals, you can choose with the same component as enum. Every value a literal can hold (string, number, bigint, boolean, null, undefined) can be chosen, and literal(10) and literal("10") are distinguished. Arms of z.null() and z.undefined() can also be chosen, and the arms take precedence when combined with optional or nullable. With uiType: "multipleEnum" or "multipleEnumBadge" on an array, you can choose several',
  "formDemo.literalUnionSelect.price.10": "10 (number)",
  "formDemo.literalUnionSelect.price.102": "10 (string)",
  "formDemo.literalUnionSelect.price.free": "Free",
  "formDemo.literalUnionSelect.size.1": "Small",
  "formDemo.literalUnionSelect.size.2": "Medium",
  "formDemo.literalUnionSelect.size.large": "Large",
  "formDemo.literalUnionSelect.answer.true": "Yes",
  "formDemo.literalUnionSelect.answer.false": "No",
  "formDemo.literalUnionSelect.answer.arm4": "Not answered",
  "formDemo.literalUnionSelect.answer.arm5": "Not applicable",
  "formDemo.literalUnionSelect.answerWith.true": "Yes",
  "formDemo.literalUnionSelect.answerWith.false": "No",
  "formDemo.literalUnionSelect.answerWith.arm2": "Not answered",
  "formDemo.literalUnionSelect.answerWith.arm22": "Not applicable",
  "formDemo.literalUnionSelect.price": "Price (required)",
  "formDemo.literalUnionSelect.optionalPrice": "Price (optional)",
  "formDemo.literalUnionSelect.nullablePrice": "Price (nullable)",
  "formDemo.literalUnionSelect.size": "Size (badge)",
  "formDemo.literalUnionSelect.prices": "Prices (multipleEnum)",
  "formDemo.literalUnionSelect.sizes": "Sizes (multipleEnumBadge)",
  "formDemo.literalUnionSelect.answer": "Answer (all values)",
  "formDemo.literalUnionSelect.answerOptional":
    "Answer (optional, undefined arm)",
  "formDemo.literalUnionSelect.answerNullable": "Answer (nullable, null arm)",
  "formDemo.literalUnionSelect.answerBoth":
    "Answer (optional, nullable, null arm)",
  "formDemo.page.literalUnionSelect.title": "zf.union (literal)",
});
