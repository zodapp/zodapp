import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（time） */
export const en = defineMessages({
  "formDemo.page.time.description":
    "Time-only input. It can be held as a string or as a number from 0:00. The value is written when you leave the field or press Enter, and an unreadable or out-of-range time is a format error. In a field whose unit is coarser than the saved value, editing sets the finer parts to 0 (opening does not rewrite it)",
  "formDemo.time.stringMinute":
    'z.iso.time({ precision: -1 }) - up to minutes ("09:30")',
  "formDemo.time.stringSecond":
    'z.iso.time({ precision: 0 }) - up to seconds ("09:30:15")',
  "formDemo.time.stringUiMinute":
    "z.iso.time() - the data can hold below seconds, but the UI is up to minutes",
  "formDemo.time.stringUiSecond":
    "z.iso.time() - the UI is up to seconds. Editing drops milliseconds",
  "formDemo.time.stringUiMillisecond":
    "z.iso.time() - the UI is up to milliseconds",
  "formDemo.time.stringMillisecond":
    "z.iso.time({ precision: 3 }) - up to milliseconds",
  "formDemo.time.stringTenthSecond":
    'z.iso.time({ precision: 1 }) - up to 0.1 seconds ("09:30:15.2")',
  "formDemo.time.numberHour": "z.number() hoursOfDay - hours only (9 for 9:00)",
  "formDemo.time.numberMinute":
    "z.number() minutesOfDay - minutes from 0:00 (570 for 9:30)",
  "formDemo.time.numberSecond": "z.number() secondsOfDay (default)",
  "formDemo.time.numberMillisecond":
    "z.number() millisecondsOfDay - milliseconds from 0:00 (34215250 for 9:30:15.250)",
});
