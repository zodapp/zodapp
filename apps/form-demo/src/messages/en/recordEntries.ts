import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（recordEntries） */
export const en = defineMessages({
  "formDemo.page.recordEntries.description":
    "Add, delete, and edit key-value pairs. A record whose keys are fixed by an enum or literal has a fixed field per key, and a Map has fields where you add and edit pairs. A partialRecord with enum keys lists all candidate keys by default with each field optional (emptying a field removes the key); with uiType: entries, only keys in the value are listed and keys are added with the select at the bottom (rows can only be deleted; the order is set by keyOrder: definition is the definition order, value is the value order)",
  "formDemo.recordEntries.envKeySchema.min": "Enter a key",
  "formDemo.recordEntries.envKeySchema.regex":
    "Only uppercase letters, digits, and underscores can be used",
  "formDemo.recordEntries.envVars": "Environment variables (uiType: entries)",
  "formDemo.recordEntries.labels":
    "Record of numbers (the value type can be any schema)",
  "formDemo.recordEntries.greeting.key.ja": "Japanese",
  "formDemo.recordEntries.greeting.key.en": "English",
  "formDemo.recordEntries.greeting.key.zh": "Chinese",
  "formDemo.recordEntries.greeting": "Greeting (enum keys)",
  "formDemo.recordEntries.stock":
    "Stock by size (keys are a literal with multiple values)",
  "formDemo.recordEntries.nicknames.key.alice": "Alice",
  "formDemo.recordEntries.nicknames.key.bob": "Bob",
  "formDemo.recordEntries.nicknames.key.carol": "Carol",
  "formDemo.recordEntries.nicknames":
    "Nicknames (partialRecord with enum keys)",
  "formDemo.recordEntries.branches":
    "Number of branches (partialRecord, uiType: entries)",
  "formDemo.recordEntries.branchesByValue":
    "Number of branches (keyOrder: value)",
  "formDemo.recordEntries.quota": "Quota (Map<string, number>)",
});
