import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（selectAndExternalKey） */
export const en = defineMessages({
  "formDemo.page.selectAndExternalKey.description":
    "Choose a person in charge or an office from a list: handling values not in the list, waiting until the list arrives, handling the list when it arrives again, and links to the detail page of the chosen value",
  "formDemo.selectAndExternalKey.citySchema.resolve.schema": "City",
  "formDemo.selectAndExternalKey.officeLegacy":
    'string + uiType: "select" (saved values not in the options pass as is)',
  "formDemo.selectAndExternalKey.status.open": "In progress",
  "formDemo.selectAndExternalKey.status.done": "Done",
  "formDemo.selectAndExternalKey.assignee":
    "externalKey (default: values not in the options are errors) + valueAction",
  "formDemo.selectAndExternalKey.assigneeFree":
    "externalKey + allowUnlisted (values not in the options also pass)",
  "formDemo.selectAndExternalKey.slowAssignee":
    "externalKey (fetching takes 3 seconds; it cannot be chosen while loading, and submission stops)",
  "formDemo.selectAndExternalKey.onDuty":
    "On duty (default clear; when the chosen person drops out of the options the value is removed, and it does not come back)",
  "formDemo.selectAndExternalKey.onDutyKeep":
    'On duty (unlisted: keep; when the value drops out it is kept with the error "(Invalid value)", and returns to the original display when it comes back)',
  "formDemo.selectAndExternalKey.prefecture": "State",
  "formDemo.selectAndExternalKey.try.heading":
    'Re-deliver the on-duty options (the two "On duty" fields subscribe to the same topic)',
  "formDemo.selectAndExternalKey.try.all": "Re-deliver everyone",
  "formDemo.selectAndExternalKey.try.without": ({ name }: { name: string }) =>
    `Re-deliver without ${name}`,
  "formDemo.selectAndExternalKey.try.rotate":
    "Re-deliver every 5 seconds, removing one person at a time",
});
