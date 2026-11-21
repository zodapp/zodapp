import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（objectEntries） */
export const en = defineMessages({
  "formDemo.page.objectEntries.title": "zf.object (adding fields)",
  "formDemo.page.objectEntries.description":
    "With uiType: entries, add only the fields you use (a search-condition example). An optional field gets a row only when it is in the value, and ⊖ removes the key. Required and nullable fields are always shown. A row that was added but left empty has an undefined key in the value and is not included in the submitted JSON. The third box uses uiType: entries-horizontal, which works the same but puts the cards in one horizontal line (cards that do not fit scroll horizontally)",
  "formDemo.objectEntries.range.min": "Min",
  "formDemo.objectEntries.range.max": "Max",
  "formDemo.objectEntries.range.order": "Min must be less than or equal to max",
  "formDemo.objectEntries.sort.newest": "Newest",
  "formDemo.objectEntries.sort.cheapest": "Cheapest",
  "formDemo.objectEntries.keyword": "Keyword",
  "formDemo.objectEntries.title": "Title",
  "formDemo.objectEntries.author": "Author",
  "formDemo.objectEntries.price": "Price",
  "formDemo.objectEntries.sort": "Sort",
  "formDemo.objectEntries.publisher": "Publisher",
  "formDemo.objectEntries.condition":
    "Search conditions (keyOrder: definition)",
  "formDemo.objectEntries.conditionByValue":
    "Search conditions (keyOrder: value)",
  "formDemo.objectEntries.conditionHorizontal":
    "Search conditions (horizontal: entries-horizontal)",
});
