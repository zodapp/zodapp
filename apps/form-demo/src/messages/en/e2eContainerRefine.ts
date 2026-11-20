import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eContainerRefine） */
export const en = defineMessages({
  "formDemo.page.e2eContainerRefine.title": "e2e: refine on containers",
  "formDemo.page.e2eContainerRefine.description":
    ".refine() without a path on an object, an array, a record, and a union. Leaving the last field of the container shows the error; fixing it clears the error and the form can be submitted. The period's end must be after its start, members must not be duplicated, the allocation must total 100 or less, and the contact email must be @example.com",
  "formDemo.e2eContainerRefine.period.start": "Start",
  "formDemo.e2eContainerRefine.period.end": "End",
  "formDemo.e2eContainerRefine.period.refine":
    "The end must be after the start",
  "formDemo.e2eContainerRefine.period": "Period (object)",
  "formDemo.e2eContainerRefine.members.item": "Member",
  "formDemo.e2eContainerRefine.members.refine": "Members are duplicated",
  "formDemo.e2eContainerRefine.members": "Members (array)",
  "formDemo.e2eContainerRefine.shares.key.a": "Company A",
  "formDemo.e2eContainerRefine.shares.key.b": "Company B",
  "formDemo.e2eContainerRefine.shares.refine":
    "The allocation must total 100 or less",
  "formDemo.e2eContainerRefine.shares": "Allocation (record)",
  "formDemo.e2eContainerRefine.contact.email.email": "Email",
  "formDemo.e2eContainerRefine.contact.email": "Email",
  "formDemo.e2eContainerRefine.contact.phone.phone": "Phone number",
  "formDemo.e2eContainerRefine.contact.phone": "Phone",
  "formDemo.e2eContainerRefine.contact.refine":
    "The email must be @example.com",
  "formDemo.e2eContainerRefine.contact": "Contact (union)",
  "formDemo.e2eContainerRefine.contact.selectorLabel": "Contact type",
  "formDemo.e2eContainerRefine.memo": "Memo",
});
