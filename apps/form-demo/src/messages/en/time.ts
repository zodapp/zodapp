import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（time） */
export const en = defineMessages({
  "formDemo.page.time.description":
    "Time-only input. It can be held as a string or as a number from 0:00. The value is written when you leave the field or press Enter, and an unreadable or out-of-range time is a format error. In a field whose unit is coarser than the saved value, editing sets the finer parts to 0 (opening does not rewrite it)",
});
