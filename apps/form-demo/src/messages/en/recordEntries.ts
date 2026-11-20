import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（recordEntries） */
export const en = defineMessages({
  "formDemo.page.recordEntries.description":
    "Add, delete, and edit key-value pairs. A record whose keys are fixed by an enum or literal has a fixed field per key, and a Map has fields where you add and edit pairs. A partialRecord with enum keys lists all candidate keys by default with each field optional (emptying a field removes the key); with uiType: entries, only keys in the value are listed and keys are added with the select at the bottom (rows can only be deleted; the order is set by keyOrder: definition is the definition order, value is the value order)",
});
