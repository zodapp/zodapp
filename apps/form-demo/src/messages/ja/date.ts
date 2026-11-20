import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/date";

/** form-demo の日本語の辞書（date） */
export const ja = {
  "formDemo.page.date.description":
    "日付・時刻の入力（様々なZod型、粒度、エンコーディング）。開いただけでは値を書き換えず、編集すると precision・unit で決まる形で書く。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる",
  "formDemo.date.dateDefault": "z.date() timestamp - デフォルト（second）",
  "formDemo.date.dateMillisecond":
    "z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示）",
  "formDemo.date.dateMillisecondReadOnly":
    "z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示）",
  "formDemo.date.dateMinute": "z.date() timestamp - 分単位（minute）",
  "formDemo.date.dateDay": "z.date() timestamp - 日単位（day）",
  "formDemo.date.dateMonth": "z.date() timestamp - 月単位（month）",
  "formDemo.date.dateYear": "z.date() timestamp - 年単位（year）",
  "formDemo.date.dateUtcDefault": "z.date() utcEncode - デフォルト（second）",
  "formDemo.date.dateUtcMinute": "z.date() utcEncode - 分単位（minute）",
  "formDemo.date.dateUtcDay": "z.date() utcEncode - 日単位（day）",
  "formDemo.date.dateUtcMonth": "z.date() utcEncode - 月単位（month）",
  "formDemo.date.dateUtcYear": "z.date() utcEncode - 年単位（year）",
  "formDemo.date.numberDefault": "z.number() - デフォルト（second, timestamp）",
  "formDemo.date.numberDay": "z.number() - 日単位（day）",
  "formDemo.date.numberUtcEncode": "z.number() - UTCエンコード（utcEncode）",
  "formDemo.date.isoDatetimeDefault":
    'z.iso.datetime() - デフォルト（second, timestamp）。秒まで書く（"2026-11-14T02:30:15Z"）',
  "formDemo.date.isoDatetimeMinute":
    'z.iso.datetime() - 分単位（minute）。秒は 00 で書く（"2026-11-14T02:30:00Z"）',
  "formDemo.date.isoDatetimePrecisionMinute":
    'z.iso.datetime({ precision: -1 }) - データは分まで（"2026-11-14T02:30Z"）、unit も minute',
  "formDemo.date.isoDatetimePrecisionSecond":
    "z.iso.datetime({ precision: 0 }) - データは秒まで",
  "formDemo.date.isoDatetimeLocalDefault":
    'z.iso.datetime({ local: true }) - デフォルト（second, native）。秒まで書く（"2026-11-14T11:30:15"）',
  "formDemo.date.isoDatetimeLocalMinute":
    'z.iso.datetime({ local: true }) - 分単位（minute）。秒は 00 で書く（"2026-11-14T11:30:00"）',
  "formDemo.date.isoDatetimeLocalPrecisionMinute":
    'z.iso.datetime({ local: true, precision: -1 }) - データは分まで（"2026-11-14T11:30"）',
  "formDemo.date.isoDateDefault": "z.iso.date() - デフォルト（day, native）",
  "formDemo.date.isoDateMonth": "z.iso.date() - 月単位（month）",
  "formDemo.date.isoDateYear": "z.iso.date() - 年単位（year）",
  "formDemo.date.utcMinute":
    "Z・unit minute（編集すると秒は 00、ミリ秒は落ちる）",
  "formDemo.date.utcSecond": "Z・unit second（編集するとミリ秒は落ちる）",
  "formDemo.date.utcMillisecond": "Z・unit millisecond（ミリ秒まで書く）",
  "formDemo.date.utcPrecisionMinute": "Z・precision -1（分まで書く）",
  "formDemo.date.utcPrecisionSecond": "Z・precision 0（秒まで書く）",
  "formDemo.date.utcPrecisionMillisecond": "Z・precision 3（ミリ秒まで書く）",
  "formDemo.date.localMinute":
    "local・unit minute（編集すると秒は 00、ミリ秒は落ちる）",
  "formDemo.date.localSecond": "local・unit second（編集するとミリ秒は落ちる）",
  "formDemo.date.localMillisecond": "local・unit millisecond（ミリ秒まで書く）",
  "formDemo.date.localPrecisionMinute": "local・precision -1（分まで書く）",
  "formDemo.date.localPrecisionSecond": "local・precision 0（秒まで書く）",
  "formDemo.date.localPrecisionMillisecond":
    "local・precision 3（ミリ秒まで書く）",
} satisfies MessagesOf<typeof en>;
