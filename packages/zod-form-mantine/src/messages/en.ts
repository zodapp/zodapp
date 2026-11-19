import { defineMessages } from "@zodapp/i18n-messages";

/** `zodFormMantine.*` の英語の辞書（型の基準） */
export const en = defineMessages({
  "zodFormMantine.enum.unlisted":
    "This value is not one of the options. Choose another one.",
  "zodFormMantine.enum.unlistedClearable":
    "This value is not one of the options. Choose another one or clear it.",
  "zodFormMantine.multipleEnum.unlisted":
    "Some values are not among the options. Remove them or choose again.",
  "zodFormMantine.multipleEnum.remove": ({ label }: { label: string }) =>
    `Remove ${label}`,
  "zodFormMantine.multipleString.placeholder": "Type and press Enter to add",
  "zodFormMantine.union.selectorLabel": "Type",
  "zodFormMantine.union.unselected": "Please select.",
  "zodFormMantine.union.selectOwners": ({ names }: { names: string[] }) =>
    `Select ${names.join(" and ")}.`,
  "zodFormMantine.object.remove": "Remove",
  "zodFormMantine.object.add": "Add",
  "zodFormMantine.time.invalidFormat": ({ format }: { format: string }) =>
    `Enter a valid time in the format ${format}.`,
  "zodFormMantine.date.monthLabelFormat": "MMMM YYYY",
  "zodFormMantine.externalFile.remove": "Remove",
  "zodFormMantine.externalFile.dropzone":
    "Drag a file here or click to select one",
  "zodFormMantine.externalFile.maxSize": "Max file size:",
  "zodFormMantine.record.duplicateKey": "This key already exists.",
  "zodFormMantine.record.key": "Key",
  "zodFormMantine.record.value": "Value",
  "zodFormMantine.record.keyFirst": "Enter a key first",
  "zodFormMantine.record.emptyRow": "empty row",
  "zodFormMantine.record.removeRow": ({ label }: { label: string }) =>
    `Remove ${label}`,
  "zodFormMantine.record.append": "Add to the end",
  "zodFormMantine.record.unsafeKey": 'Keys cannot contain ".", "[" or "]".',
  "zodFormMantine.record.emptyKey": "Enter a key.",
  "zodFormMantine.record.uneditable":
    "This entry cannot be edited in this form.",
  "zodFormMantine.unsafeKeyName": "This key name cannot be used.",
  "zodFormMantine.unsupported":
    "This form cannot handle this combination of schemas.",
  "zodFormMantine.unsupportedSchema": "This form cannot handle this schema.",
});
