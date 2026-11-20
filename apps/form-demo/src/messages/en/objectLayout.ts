import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（objectLayout） */
export const en = defineMessages({
  "formDemo.page.objectLayout.title": "zf.object (layout)",
  "formDemo.page.objectLayout.description":
    "Lay fields out horizontally, put them in a frame, and change the display order",
  "formDemo.objectLayout.nameFields.lastName": "Last name",
  "formDemo.objectLayout.nameFields.firstName": "First name",
  "formDemo.objectLayout.nameFields.lastNameKana": "Last name (reading)",
  "formDemo.objectLayout.nameFields.firstNameKana": "First name (reading)",
  "formDemo.objectLayout.horizontal": "Horizontal (uiType: horizontal)",
  "formDemo.objectLayout.horizontalWrap":
    "Horizontal with wrapping (uiType: horizontal-wrap)",
  "formDemo.objectLayout.boxed": "Boxed (uiType: box)",
  "formDemo.objectLayout.reordered":
    "Display order (properties: reading before name)",
  "formDemo.objectLayout.horizontalErrors":
    "Errors in a row (submit to show errors)",
  "formDemo.objectLayout.horizontalErrors.keyword": "Keyword",
  "formDemo.objectLayout.horizontalErrors.period.from": "From",
  "formDemo.objectLayout.horizontalErrors.period.to": "To",
  "formDemo.objectLayout.horizontalErrors.filter": "Filter",
  "formDemo.objectLayout.horizontalErrors.filter.activeOnly": "Active only",
});
