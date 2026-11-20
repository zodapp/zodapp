import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（zodBuiltins） */
export const en = defineMessages({
  "formDemo.page.zodBuiltins.title": "Using zod types as is",
  "formDemo.page.zodBuiltins.description":
    "How pipe, transform, set, map, file, readonly, numeric enums, records with fixed keys, literal, and optional recursion are shown when written without zf",
  "formDemo.zodBuiltins.treeNode.name": "Name",
  "formDemo.zodBuiltins.visibility": "Visibility (multiple literal values)",
  "formDemo.zodBuiltins.tags": "Tags (comma-separated → array)",
  "formDemo.zodBuiltins.channels": "Notify (Set<enum>)",
  "formDemo.zodBuiltins.keywords": "Keywords (Set<string>)",
  "formDemo.zodBuiltins.title.key.ja": "Japanese",
  "formDemo.zodBuiltins.title.key.en": "English",
  "formDemo.zodBuiltins.title": "Title (record with fixed keys)",
  "formDemo.zodBuiltins.priority": "Priority (numeric TS enum)",
  "formDemo.zodBuiltins.limits": "Limits (Map<string, number>)",
  "formDemo.zodBuiltins.attachment": "Attachment (z.file())",
  "formDemo.zodBuiltins.author.name": "Author name",
  "formDemo.zodBuiltins.author": "Author (readonly)",
  "formDemo.zodBuiltins.outline": "Outline (optional recursion)",
});
