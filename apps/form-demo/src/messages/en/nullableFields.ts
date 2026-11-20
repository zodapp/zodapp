import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（nullableFields） */
export const en = defineMessages({
  "formDemo.page.nullableFields.description":
    "The value written when a field is emptied: null for a nullable-only field (not a required error; it can be submitted empty), and undefined for an optional field (including one that is both optional and nullable). A nullable object starts as null, opens with +, and returns to null with delete",
  "formDemo.nullableFields.colorField.red": "Red",
  "formDemo.nullableFields.colorField.blue": "Blue",
  "formDemo.nullableFields.nullableText": "Text (nullable)",
  "formDemo.nullableFields.nullableNumber": "Number (nullable)",
  "formDemo.nullableFields.nullableColor": "Color (nullable)",
  "formDemo.nullableFields.nullableDate": "Date (nullable)",
  "formDemo.nullableFields.optionalNullableText": "Text (optional, nullable)",
  "formDemo.nullableFields.optionalText": "Text (optional)",
  "formDemo.nullableFields.nullableDetail.note": "Notes",
  "formDemo.nullableFields.nullableDetail.count": "Count",
  "formDemo.nullableFields.nullableDetail": "Details (nullable)",
  "formDemo.nullableFields.optionalDetail.memo": "Memo",
  "formDemo.nullableFields.optionalDetail": "Supplement (optional)",
  "formDemo.page.nullableFields.title": "nullable / optional",
});
