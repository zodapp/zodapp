import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eContainerRefine） */
export const en = defineMessages({
  "formDemo.page.e2eContainerRefine.title": "e2e: refine on containers",
  "formDemo.page.e2eContainerRefine.description":
    ".refine() without a path on an object, an array, a record, and a union. Leaving the last field of the container shows the error; fixing it clears the error and the form can be submitted. The period's end must be after its start, members must not be duplicated, the allocation must total 100 or less, and the contact email must be @example.com",
});
