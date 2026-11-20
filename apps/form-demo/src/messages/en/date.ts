import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（date） */
export const en = defineMessages({
  "formDemo.page.date.description":
    "Date and time input (various Zod types, granularities, and encodings). Opening the form does not rewrite values; editing writes the form decided by precision and unit. In a field whose unit is coarser than the saved value, editing sets the finer parts to 0",
  "formDemo.date.dateDefault": "z.date() timestamp - default (second)",
  "formDemo.date.dateMillisecond":
    "z.date() timestamp - milliseconds (millisecond, shown only in readOnly)",
  "formDemo.date.dateMillisecondReadOnly":
    "z.date() timestamp - milliseconds (millisecond, shown only in readOnly)",
  "formDemo.date.dateMinute": "z.date() timestamp - minutes (minute)",
  "formDemo.date.dateDay": "z.date() timestamp - days (day)",
  "formDemo.date.dateMonth": "z.date() timestamp - months (month)",
  "formDemo.date.dateYear": "z.date() timestamp - years (year)",
  "formDemo.date.dateUtcDefault": "z.date() utcEncode - default (second)",
  "formDemo.date.dateUtcMinute": "z.date() utcEncode - minutes (minute)",
  "formDemo.date.dateUtcDay": "z.date() utcEncode - days (day)",
  "formDemo.date.dateUtcMonth": "z.date() utcEncode - months (month)",
  "formDemo.date.dateUtcYear": "z.date() utcEncode - years (year)",
  "formDemo.date.numberDefault": "z.number() - default (second, timestamp)",
  "formDemo.date.numberDay": "z.number() - days (day)",
  "formDemo.date.numberUtcEncode": "z.number() - UTC encoding (utcEncode)",
  "formDemo.date.isoDatetimeDefault":
    'z.iso.datetime() - default (second, timestamp). Writes up to seconds ("2026-11-14T02:30:15Z")',
  "formDemo.date.isoDatetimeMinute":
    'z.iso.datetime() - minutes (minute). Writes seconds as 00 ("2026-11-14T02:30:00Z")',
  "formDemo.date.isoDatetimePrecisionMinute":
    'z.iso.datetime({ precision: -1 }) - data up to minutes ("2026-11-14T02:30Z"), unit is also minute',
  "formDemo.date.isoDatetimePrecisionSecond":
    "z.iso.datetime({ precision: 0 }) - data up to seconds",
  "formDemo.date.isoDatetimeLocalDefault":
    'z.iso.datetime({ local: true }) - default (second, native). Writes up to seconds ("2026-11-14T11:30:15")',
  "formDemo.date.isoDatetimeLocalMinute":
    'z.iso.datetime({ local: true }) - minutes (minute). Writes seconds as 00 ("2026-11-14T11:30:00")',
  "formDemo.date.isoDatetimeLocalPrecisionMinute":
    'z.iso.datetime({ local: true, precision: -1 }) - data up to minutes ("2026-11-14T11:30")',
  "formDemo.date.isoDateDefault": "z.iso.date() - default (day, native)",
  "formDemo.date.isoDateMonth": "z.iso.date() - months (month)",
  "formDemo.date.isoDateYear": "z.iso.date() - years (year)",
  "formDemo.date.utcMinute":
    "Z, unit minute (editing sets seconds to 00 and drops milliseconds)",
  "formDemo.date.utcSecond": "Z, unit second (editing drops milliseconds)",
  "formDemo.date.utcMillisecond":
    "Z, unit millisecond (writes up to milliseconds)",
  "formDemo.date.utcPrecisionMinute": "Z, precision -1 (writes up to minutes)",
  "formDemo.date.utcPrecisionSecond": "Z, precision 0 (writes up to seconds)",
  "formDemo.date.utcPrecisionMillisecond":
    "Z, precision 3 (writes up to milliseconds)",
  "formDemo.date.localMinute":
    "local, unit minute (editing sets seconds to 00 and drops milliseconds)",
  "formDemo.date.localSecond":
    "local, unit second (editing drops milliseconds)",
  "formDemo.date.localMillisecond":
    "local, unit millisecond (writes up to milliseconds)",
  "formDemo.date.localPrecisionMinute":
    "local, precision -1 (writes up to minutes)",
  "formDemo.date.localPrecisionSecond":
    "local, precision 0 (writes up to seconds)",
  "formDemo.date.localPrecisionMillisecond":
    "local, precision 3 (writes up to milliseconds)",
});
