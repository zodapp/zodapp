import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（intersection） */
export const en = defineMessages({
  "formDemo.page.intersection.description":
    'An intersection (a.and(b)) places both sides at the same path. With uiType: "flat" on a child object or union, they are laid out without a frame, looking like one object. Errors at the same path (including .refine() without a path on a child object or a union arm) are shown once by the intersection. To show one inside an arm, point to the field with the path of .refine()',
});
