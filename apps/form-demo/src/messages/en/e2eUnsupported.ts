import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（e2eUnsupported） */
export const en = defineMessages({
  "formDemo.page.e2eUnsupported.title": "e2e: notes for unsupported types",
  "formDemo.page.e2eUnsupported.description":
    'A tuple with rest, an array whose uiType does not match the element type, and a set of objects show the note "Not supported" in place of the field, and the other fields are drawn. A key name that cannot be used (containing .) shows "This key name cannot be used", and such keys saved in a record are shown as rows that cannot be edited. Because of z.promise() and an async refine, submission stops and the reason is shown',
  "formDemo.e2eUnsupported.title": "Heading",
  "formDemo.e2eUnsupported.scores": "Scores (tuple with rest)",
  "formDemo.e2eUnsupported.numbers":
    "Array of numbers (uiType: multipleString)",
  "formDemo.e2eUnsupported.points": "Set of points (Set<object>)",
  "formDemo.e2eUnsupported.settings.a_b": "Value of a.b",
  "formDemo.e2eUnsupported.settings.ok": "Usable value",
  "formDemo.e2eUnsupported.settings": "Settings (key names containing .)",
  "formDemo.e2eUnsupported.tags": "Tags (unusable keys in the saved value)",
  "formDemo.e2eUnsupported.pending": "Value being fetched (promise)",
  "formDemo.e2eUnsupported.handle": "Handle (async refine)",
});
