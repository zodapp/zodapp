import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（tableView） */
export const en = defineMessages({
  "formDemo.page.tableView.title": "Table (AutoTable)",
  "formDemo.page.tableView.description":
    "computed (calculated from the row's values) and dynamic cells in a table, labels of string selects, valueAction, externalKey, and date and time display. Clicking a header sorts by the rule of each column type (dynamic columns are not sorted). Cells with values not in the options are also shown",
  "formDemo.tableView.amountSchema.resolve.schema": "Amount",
  "formDemo.tableView.office": "Office (select)",
  "formDemo.tableView.status.todo": "To do",
  "formDemo.tableView.status.open": "In progress",
  "formDemo.tableView.status.done": "Done",
  "formDemo.tableView.status": "Status (valueAction)",
  "formDemo.tableView.assignee": "Assignee (externalKey)",
  "formDemo.tableView.due": "Due date",
  "formDemo.tableView.start": "Start (time)",
  "formDemo.tableView.unitPrice": "Unit price",
  "formDemo.tableView.quantity": "Quantity",
  "formDemo.tableView.total": "Subtotal (computed)",
  "formDemo.tableView.currency.JPY": "Yen",
  "formDemo.tableView.currency.USD": "Dollars",
  "formDemo.tableView.currency": "Currency",
  "formDemo.tableView.amount": "Amount (dynamic)",
  "formDemo.tableView.note":
    '"Office" is shown with the suggestions labels, and values not in the options are shown as is. Values not in the options of "Status" and "Assignee" are shown as "(Invalid value)". "Amount" changes its display by the row\'s currency. Click a header to sort; each click switches between ascending and descending ("Amount" is not sorted).',
});
