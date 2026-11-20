import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（dynamicAdvanced） */
export const en = defineMessages({
  "formDemo.page.dynamicAdvanced.title":
    "zf.dynamic (loading, subscribing, linking)",
  "formDemo.page.dynamicAdvanced.description":
    'Load a schema from the server (loading, failure, retry), a limit that keeps changing, and linked address fields (US: state → city → neighborhood; Japan: prefecture → municipality → town). Changing the form type re-fetches only the form fields. Making a fetch fail shows "Retry" and stops submission. Changing an upper address field clears the lower fields in order. Choose when fetches arrive in "Try it"; with "Hold", advance one fetch at a time with "Deliver" and "Fail"',
  "formDemo.dynamicAdvanced.templateFields.invoice.dueDate": "Due date",
  "formDemo.dynamicAdvanced.templateFields.invoice.amount": "Amount billed",
  "formDemo.dynamicAdvanced.templateFields.invoice": "Invoice fields",
  "formDemo.dynamicAdvanced.templateFields.receipt.payer": "Payee",
  "formDemo.dynamicAdvanced.templateFields.receipt.note": "Description",
  "formDemo.dynamicAdvanced.templateFields.receipt.reissued": "Reissued",
  "formDemo.dynamicAdvanced.templateFields.receipt": "Receipt fields",
  "formDemo.dynamicAdvanced.template.invoice": "Invoice",
  "formDemo.dynamicAdvanced.template.receipt": "Receipt",
  "formDemo.dynamicAdvanced.template": "Form type",
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
  "formDemo.dynamicAdvanced.addressUs": "Address (US)",
  "formDemo.dynamicAdvanced.addressUs.state": "State",
  "formDemo.dynamicAdvanced.addressUs.city": "City",
  "formDemo.dynamicAdvanced.addressUs.city.emptyMessage":
    "Select a state first",
  "formDemo.dynamicAdvanced.addressUs.neighborhood": "Neighborhood",
  "formDemo.dynamicAdvanced.addressUs.neighborhood.emptyMessage":
    "Select a city first",
  "formDemo.dynamicAdvanced.addressJp":
    "Address (Japan; the options are data, so they stay in Japanese in any language)",
  "formDemo.dynamicAdvanced.addressJp.prefecture": "Prefecture",
  "formDemo.dynamicAdvanced.addressJp.city": "Municipality",
  "formDemo.dynamicAdvanced.addressJp.city.emptyMessage":
    "Select a prefecture first",
  "formDemo.dynamicAdvanced.addressJp.town": "Town",
  "formDemo.dynamicAdvanced.addressJp.town.emptyMessage":
    "Select a municipality first",
});
