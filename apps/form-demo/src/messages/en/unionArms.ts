import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（unionArms） */
export const en = defineMessages({
  "formDemo.page.unionArms.title": "zf.union (various arms)",
  "formDemo.page.unionArms.description":
    "Mix string, number, boolean, option, literal, and object arms in a union without a discriminator. The chosen arm is remembered, and the value is written in that arm's type (a number for the number arm). A value that passes both arms stays in the chosen arm. When the value changes from outside and no longer passes the current arm, it switches to an arm that passes",
  "formDemo.unionArms.textNumberObjectArms.arm0.min":
    "Enter at least 3 characters",
  "formDemo.unionArms.textNumberObjectArms.arm0": "String",
  "formDemo.unionArms.textNumberObjectArms.arm1.multipleOf":
    "Enter a multiple of 5",
  "formDemo.unionArms.textNumberObjectArms.arm1": "Number",
  "formDemo.unionArms.textNumberObjectArms.arm2.text.min":
    "Enter at least 3 characters for the body",
  "formDemo.unionArms.textNumberObjectArms.arm2.text": "Body",
  "formDemo.unionArms.textNumberObjectArms.arm2": "Object",
  "formDemo.unionArms.answerArms.arm0": "Yes / No",
  "formDemo.unionArms.answerArms.unknown": "Not sure",
  "formDemo.unionArms.answerArms.arm2.min": "Enter at least 1 character",
  "formDemo.unionArms.answerArms.arm2": "Other (free text)",
  "formDemo.unionArms.value": "Value (string, number, object)",
  "formDemo.unionArms.value.selectorLabel": "Value type",
  "formDemo.unionArms.code": "Code (string or number)",
  "formDemo.unionArms.code.selectorLabel": "How to write the code",
  "formDemo.unionArms.size.arm0": "Choose",
  "formDemo.unionArms.size.arm1": "Free text",
  "formDemo.unionArms.size": "Size (choose or write freely)",
  "formDemo.unionArms.size.selectorLabel": "How to decide the size",
  "formDemo.unionArms.answer": "Answer (boolean, literal, string)",
  "formDemo.unionArms.answer.selectorLabel": "How to answer",
  "formDemo.unionArms.memo": "Memo (optional; can be left empty)",
  "formDemo.unionArms.memo.selectorLabel": "Memo type",
  "formDemo.unionArms.note": "Notes (nullable; can be left empty)",
  "formDemo.unionArms.note.selectorLabel": "Notes type",
  "formDemo.unionArms.required":
    "Required value (submitting it empty is an error)",
  "formDemo.unionArms.required.selectorLabel": "Required value type",
  "formDemo.unionArms.items.item.selectorLabel": "Item type",
  "formDemo.unionArms.items": "Items (union in an array)",
  "formDemo.unionArms.readOnlyView.text": "String arm",
  "formDemo.unionArms.readOnlyView.text.selectorLabel": "Type (string)",
  "formDemo.unionArms.readOnlyView.number": "Number arm",
  "formDemo.unionArms.readOnlyView.number.selectorLabel": "Type (number)",
  "formDemo.unionArms.readOnlyView.object": "Object arm",
  "formDemo.unionArms.readOnlyView.object.selectorLabel": "Type (object)",
  "formDemo.unionArms.readOnlyView.boolean": "Boolean arm",
  "formDemo.unionArms.readOnlyView.boolean.selectorLabel": "Type (boolean)",
  "formDemo.unionArms.readOnlyView.literal": "literal arm",
  "formDemo.unionArms.readOnlyView.literal.selectorLabel": "Type (literal)",
  "formDemo.unionArms.readOnlyView": "Read-only fields",
  "formDemo.unionArms.draft.text.text.min": "Enter the body",
  "formDemo.unionArms.draft.text.text": "Draft body",
  "formDemo.unionArms.draft.text": "Text",
  "formDemo.unionArms.draft.amount.amount": "Draft amount",
  "formDemo.unionArms.draft.amount": "Amount",
  "formDemo.unionArms.draft":
    "Draft (a value saved partway through; the arm is inferred from type)",
  "formDemo.unionArms.draft.selectorLabel": "Draft type",
  "formDemo.unionArms.unknownSaved":
    "Saved value that matches no arm (opens with the arm empty)",
  "formDemo.unionArms.unknownSaved.selectorLabel": "Saved value type",
  "formDemo.unionArms.arms.asText": "Write as a string",
  "formDemo.unionArms.arms.asNumber": "Write as a number",
  "formDemo.unionArms.arms.text": "Text",
  "formDemo.unionArms.arms.number": "Number",
  "formDemo.unionArms.arms.string": "String",
  "formDemo.unionArms.arms.numeric": "Number",
  "formDemo.unionArms.harness.writeNumber":
    "Write from outside (set the value to the number 10)",
  "formDemo.unionArms.harness.writeObject":
    "Write from outside (set the value to an object)",
  "formDemo.unionArms.harness.writeString":
    "Write from outside (set the value to a string)",
});
