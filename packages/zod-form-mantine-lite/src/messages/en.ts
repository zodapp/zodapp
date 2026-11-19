import { defineMessages } from "@zodapp/i18n-messages";

/** `zodFormMantineLite.*` の英語の辞書（型の基準） */
export const en = defineMessages({
  "zodFormMantineLite.unlisted": "(Invalid value)",
  "zodFormMantineLite.selectedItem": "selected item",
  "zodFormMantineLite.open": ({ label }: { label: string }) => `Open ${label}`,
  "zodFormMantineLite.noOptions": "No options",
  "zodFormMantineLite.nothingFound": "Nothing found",
  "zodFormMantineLite.clear": "Clear",
  "zodFormMantineLite.download": "Download",
  "zodFormMantineLite.fetchFailed": "Failed to load",
  "zodFormMantineLite.fetchFailedWithLabel": ({ label }: { label: string }) =>
    `Failed to load ${label}`,
  "zodFormMantineLite.retry": "Retry",
  "zodFormMantineLite.yes": "Yes",
  "zodFormMantineLite.no": "No",
});
