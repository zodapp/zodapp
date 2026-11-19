import { defineMessages } from "@zodapp/i18n-messages";

type Count = { count: number };
type Scan = { scanned: number; filtered: number };
type ErrorMessage = { message: string };
type Profile = { scope: string; name: string };

/** zod-form-widget の英語の辞書（型の基準） */
export const en = defineMessages({
  "zodFormWidget.common.cancel": "Cancel",

  "zodFormWidget.autoForm.submit": "Save",
  "zodFormWidget.autoForm.blocked.loading":
    "Could not submit because some fields are still loading.",
  "zodFormWidget.autoForm.blocked.failed":
    "Could not submit because some fields failed to load.",
  "zodFormWidget.autoForm.blocked.input":
    "Could not submit because some fields have errors.",

  "zodFormWidget.delete.title": "Confirm deletion",
  "zodFormWidget.delete.confirm": "Delete",
  "zodFormWidget.delete.failed": "Failed to delete.",
  "zodFormWidget.delete.menuItem": "Delete",

  "zodFormWidget.fetchMore.emptyWithMore": "No items match the filter.",
  "zodFormWidget.fetchMore.emptyNoMore": "No items yet. Create a new one.",
  "zodFormWidget.fetchMore.loadingTooltip": ({ scanned, filtered }: Scan) =>
    `Scanning ${scanned} items, ${filtered} matched.`,
  "zodFormWidget.fetchMore.hasMoreTooltip": ({ scanned, filtered }: Scan) =>
    `Scanned ${scanned} items, ${filtered} matched. More can be loaded.`,
  "zodFormWidget.fetchMore.doneTooltip": ({ scanned, filtered }: Scan) =>
    `Scanned all ${scanned} items, ${filtered} matched.`,
  "zodFormWidget.fetchMore.loading": "Loading...",
  "zodFormWidget.fetchMore.loadMore": "Load more",
  "zodFormWidget.fetchMore.done": "All items loaded",

  "zodFormWidget.export.title": "Export data",
  "zodFormWidget.export.noData": "There is no data to export.",
  "zodFormWidget.export.fetchError": ({ message }: ErrorMessage) =>
    `Fetch error: ${message}`,
  "zodFormWidget.export.fetchFailed": "Failed to fetch the data.",
  "zodFormWidget.export.nothingShown": "No data is currently shown.",
  "zodFormWidget.export.download": "Fetch all and download CSV",
  "zodFormWidget.export.preview": ({ count }: Count) =>
    `Previewing the first ${count} rows.`,
  "zodFormWidget.export.downloadNote":
    "Downloading fetches and exports all rows.",

  "zodFormWidget.import.title": "Import data",
  "zodFormWidget.import.selected": ({ name }: { name: string }) =>
    `Selected: ${name}`,
  "zodFormWidget.import.plannedAll": ({ count }: Count) =>
    `${count} rows will be imported (showing all ${count}).`,
  "zodFormWidget.import.plannedHead": ({
    count,
    limit,
  }: Count & { limit: number }) =>
    `${count} rows will be imported (showing the first ${limit}).`,
  "zodFormWidget.import.importError": ({ message }: ErrorMessage) =>
    `Import error: ${message}`,
  "zodFormWidget.import.importFailed": "Failed to import.",
  "zodFormWidget.import.csvSubmit": "Import CSV",
  "zodFormWidget.import.csvDescription":
    "Select a CSV file and review its contents before importing.",
  "zodFormWidget.import.csvDropzone":
    "Drag a CSV file here, or click to select one",
  "zodFormWidget.import.csvDropzoneHint": "Select one CSV file",
  "zodFormWidget.import.csvNoRows": "The CSV has no data rows.",
  "zodFormWidget.import.csvNothingToImport":
    "The CSV has no rows that can be imported.",
  "zodFormWidget.import.csvParseError": ({ message }: ErrorMessage) =>
    `CSV parse error: ${message}`,
  "zodFormWidget.import.csvParseFailed": "Failed to parse the CSV.",
  "zodFormWidget.import.csvSelectFile": "Select a CSV file.",
  "zodFormWidget.import.csvEmpty": "No CSV selected yet.",
  "zodFormWidget.import.fileSubmit": "Import data",
  "zodFormWidget.import.fileDescription":
    "Select a file and review its contents before importing.",
  "zodFormWidget.import.selectFile": "Select file",
  "zodFormWidget.import.fileEmpty": "No file selected yet.",
  "zodFormWidget.import.parseError": ({ message }: ErrorMessage) =>
    `Parse error: ${message}`,
  "zodFormWidget.import.parseFailed": "Failed to parse the file.",

  "zodFormWidget.tabular.emptyFile": "The CSV file is empty.",
  "zodFormWidget.tabular.noHeader": "The CSV header was not found.",
  "zodFormWidget.tabular.noRows": "The CSV has no data rows.",

  "zodFormWidget.table.sort": ({ label }: { label: string }) =>
    `Sort by ${label}`,
  "zodFormWidget.table.scrollToTop": "Scroll to the top of the list",
  "zodFormWidget.table.scrollToBottom": "Scroll to the bottom of the list",

  "zodFormWidget.tableSetting.title": "Table settings",
  "zodFormWidget.tableSetting.recordOptionGroup": "Suggestions",
  "zodFormWidget.tableSetting.width": "Width",
  "zodFormWidget.tableSetting.otherScope": "Other",
  "zodFormWidget.tableSetting.defaultProfile": "Default",
  "zodFormWidget.tableSetting.duplicateName":
    "A profile with the same name already exists in the selected location.",
  "zodFormWidget.tableSetting.editing": "Editing",
  "zodFormWidget.tableSetting.discard": "Discard changes",
  "zodFormWidget.tableSetting.deleteProfile": "Delete profile",
  "zodFormWidget.tableSetting.readOnly": "Read-only",
  "zodFormWidget.tableSetting.saveAs": "Save as",
  "zodFormWidget.tableSetting.overwrite": "Save",
  "zodFormWidget.tableSetting.saveConfirmTitle": "Confirm save",
  "zodFormWidget.tableSetting.saveConfirm": ({ scope, name }: Profile) =>
    `Overwrite the ${scope} setting "${name}"?`,
  "zodFormWidget.tableSetting.profileName": "Profile name",
  "zodFormWidget.tableSetting.namePlaceholder": "Enter a name",
  "zodFormWidget.tableSetting.saveTo": "Save to",
  "zodFormWidget.tableSetting.save": "Save",
  "zodFormWidget.tableSetting.deleteConfirmTitle": "Confirm deletion",
  "zodFormWidget.tableSetting.deleteConfirm": ({ scope, name }: Profile) =>
    `Delete the ${scope} setting "${name}"? This cannot be undone.`,
  "zodFormWidget.tableSetting.delete": "Delete",
});
