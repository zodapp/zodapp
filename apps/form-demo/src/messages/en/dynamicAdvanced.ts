import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（dynamicAdvanced） */
export const en = defineMessages({
  "formDemo.page.dynamicAdvanced.title":
    "zf.dynamic (loading, subscribing, linking)",
  "formDemo.page.dynamicAdvanced.description":
    'Load a schema from a server (loading, failure, retry), a limit that keeps changing, and the state → city → neighborhood cascade. Changing the form type reloads only the form\'s fields. When a fetch fails, "Retry" appears and submission stops. Changing the state clears the city and the neighborhood in order. Choose when fetches arrive in "Try it"; with the hold mode, advance one fetch at a time with "Deliver" and "Fail"',
  "formDemo.dynamicAdvanced.templateFields.invoice.dueDate": "Due date",
  "formDemo.dynamicAdvanced.templateFields.invoice.amount": "Amount billed",
  "formDemo.dynamicAdvanced.templateFields.invoice": "Invoice fields",
  "formDemo.dynamicAdvanced.templateFields.receipt.payer": "Payee",
  "formDemo.dynamicAdvanced.templateFields.receipt.note": "Description",
  "formDemo.dynamicAdvanced.templateFields.receipt.reissued": "Reissued",
  "formDemo.dynamicAdvanced.templateFields.receipt": "Receipt fields",
  "formDemo.dynamicAdvanced.citySchema.resolve.schema": "City",
  "formDemo.dynamicAdvanced.citySchema.resolve.schema.emptyMessage":
    "Choose a state first",
  "formDemo.dynamicAdvanced.townSchema.resolve.schema": "Neighborhood",
  "formDemo.dynamicAdvanced.townSchema.resolve.schema.emptyMessage":
    "Choose a city first",
  "formDemo.dynamicAdvanced.template.invoice": "Invoice",
  "formDemo.dynamicAdvanced.template.receipt": "Receipt",
  "formDemo.dynamicAdvanced.template": "Form type",
  "formDemo.dynamicAdvanced.prefecture": "State",
  "formDemo.dynamicAdvanced.quantity.max": ({ stock }: { stock: string }) =>
    `Exceeds the stock (${stock})`,
  "formDemo.dynamicAdvanced.quantity": ({ stock }: { stock: string }) =>
    `Quantity (stock ${stock})`,
  "formDemo.dynamicAdvanced.harness.toggle":
    "Write from outside (switch the form type)",
  "formDemo.dynamicAdvanced.harness.toggleAsUser":
    "Write as a user edit (switch the form type)",
  "formDemo.dynamicAdvanced.try.description":
    'Choose when fetches arrive, make them fail on purpose, and change the stock. Normally keep "Visible delay" (1 second for the form fields, 0.4 seconds for options). With the hold mode, advance one fetch at a time with "Deliver" and "Fail"',
  "formDemo.dynamicAdvanced.try.rotate": "Change the stock every 3 seconds",
  "formDemo.dynamicAdvanced.try.stock3": "Set the stock to 3",
  "formDemo.dynamicAdvanced.try.stock10": "Set the stock to 10",
});
