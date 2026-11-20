import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconCalendar } from "@tabler/icons-react";

export const formId = "date";
export const title = "zf.date";
export const description = msgKey(
  "formDemo.page.date.description" /* i18n: 日付・時刻の入力（様々なZod型、粒度、エンコーディング）。開いただけでは値を書き換えず、編集すると precision・unit で決まる形で書く。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる */,
);
export const icon = IconCalendar;
export const category = "Basic";

export const schema = z
  .object({
    // ============================================================
    // 1.1 z.date() + timestamp（TZ非依存・デフォルト）
    // ============================================================
    dateDefault: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateDefault" /* i18n: z.date() timestamp - デフォルト（second） */,
      ),
    }),
    dateMillisecond: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateMillisecond" /* i18n: z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示） */,
      ),
      unit: "millisecond",
    }),
    dateMillisecondReadOnly: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateMillisecondReadOnly" /* i18n: z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示） */,
      ),
      unit: "millisecond",
      readOnly: true,
    }),
    dateMinute: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateMinute" /* i18n: z.date() timestamp - 分単位（minute） */,
      ),
      unit: "minute",
    }),
    dateDay: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateDay" /* i18n: z.date() timestamp - 日単位（day） */,
      ),
      unit: "day",
    }),
    dateMonth: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateMonth" /* i18n: z.date() timestamp - 月単位（month） */,
      ),
      unit: "month",
    }),
    dateYear: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateYear" /* i18n: z.date() timestamp - 年単位（year） */,
      ),
      unit: "year",
    }),

    // ============================================================
    // 1.2 z.date() + utcEncode（タイムドリフト）
    // ユーザー入力をUTC基準でエンコード（TZ依存の日付をInstantで保存）
    // ============================================================
    dateUtcDefault: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateUtcDefault" /* i18n: z.date() utcEncode - デフォルト（second） */,
      ),
      encoding: "utcEncode",
    }),
    dateUtcMinute: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateUtcMinute" /* i18n: z.date() utcEncode - 分単位（minute） */,
      ),
      unit: "minute",
      encoding: "utcEncode",
    }),
    dateUtcDay: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateUtcDay" /* i18n: z.date() utcEncode - 日単位（day） */,
      ),
      unit: "day",
      encoding: "utcEncode",
    }),
    dateUtcMonth: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateUtcMonth" /* i18n: z.date() utcEncode - 月単位（month） */,
      ),
      unit: "month",
      encoding: "utcEncode",
    }),
    dateUtcYear: z.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.dateUtcYear" /* i18n: z.date() utcEncode - 年単位（year） */,
      ),
      unit: "year",
      encoding: "utcEncode",
    }),

    // ============================================================
    // 2. z.number() - Unix epoch ms
    // ============================================================
    numberDefault: z.number().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.numberDefault" /* i18n: z.number() - デフォルト（second, timestamp） */,
      ),
    }),
    numberDay: z.number().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.numberDay" /* i18n: z.number() - 日単位（day） */,
      ),
      unit: "day",
    }),
    numberUtcEncode: z.number().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.numberUtcEncode" /* i18n: z.number() - UTCエンコード（utcEncode） */,
      ),
      unit: "day",
      encoding: "utcEncode",
    }),

    // ============================================================
    // 3. z.iso.datetime() - ISO datetime with Z (TZ非依存)
    // precision が無ければ unit の粒度で書く（minute / second は秒まで、millisecond はミリ秒まで）。
    // precision があれば precision に合わせて書き、それより細かい unit はエラーになる。
    // どちらも値を変えたときだけ書く（開いただけでは触らない）
    // ============================================================
    isoDatetimeDefault: z.iso.datetime().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.isoDatetimeDefault" /* i18n: z.iso.datetime() - デフォルト（second, timestamp）。秒まで書く（"2026-11-14T02:30:15Z"） */,
      ),
    }),
    isoDatetimeMinute: z.iso.datetime().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.isoDatetimeMinute" /* i18n: z.iso.datetime() - 分単位（minute）。秒は 00 で書く（"2026-11-14T02:30:00Z"） */,
      ),
      unit: "minute",
    }),
    isoDatetimePrecisionMinute: z.iso
      .datetime({ precision: -1 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.isoDatetimePrecisionMinute" /* i18n: z.iso.datetime({ precision: -1 }) - データは分まで（"2026-11-14T02:30Z"）、unit も minute */,
        ),
      }),
    isoDatetimePrecisionSecond: z.iso
      .datetime({ precision: 0 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.isoDatetimePrecisionSecond" /* i18n: z.iso.datetime({ precision: 0 }) - データは秒まで */,
        ),
      }),

    // ============================================================
    // 4. z.iso.datetime({ local: true }) - ISO datetime local (TZ依存)
    // 書き方の決まりは 3. と同じ（末尾に Z が付かないだけ）
    // ============================================================
    isoDatetimeLocalDefault: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.isoDatetimeLocalDefault" /* i18n: z.iso.datetime({ local: true }) - デフォルト（second, native）。秒まで書く（"2026-11-14T11:30:15"） */,
        ),
      }),
    isoDatetimeLocalMinute: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.isoDatetimeLocalMinute" /* i18n: z.iso.datetime({ local: true }) - 分単位（minute）。秒は 00 で書く（"2026-11-14T11:30:00"） */,
        ),
        unit: "minute",
      }),
    isoDatetimeLocalPrecisionMinute: z.iso
      .datetime({ local: true, precision: -1 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.isoDatetimeLocalPrecisionMinute" /* i18n: z.iso.datetime({ local: true, precision: -1 }) - データは分まで（"2026-11-14T11:30"） */,
        ),
      }),

    // ============================================================
    // 5. z.iso.date() - ISO date (TZ依存)
    // ============================================================
    isoDateDefault: z.iso.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.isoDateDefault" /* i18n: z.iso.date() - デフォルト（day, native） */,
      ),
    }),
    isoDateMonth: z.iso.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.isoDateMonth" /* i18n: z.iso.date() - 月単位（month） */,
      ),
      unit: "month",
    }),
    isoDateYear: z.iso.date().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.isoDateYear" /* i18n: z.iso.date() - 年単位（year） */,
      ),
      unit: "year",
    }),

    // ============================================================
    // 6. precision・unit で書かれる形（初期値は固定の日時で、unit より細かい部分まで持つ）
    // precision なしの欄は unit で書く形が決まる。unit が保存値より粗いと、編集したときに細かい部分が 0 になる
    // ============================================================
    utcMinute: z.iso.datetime().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.utcMinute" /* i18n: Z・unit minute（編集すると秒は 00、ミリ秒は落ちる） */,
      ),
      unit: "minute",
    }),
    utcSecond: z.iso.datetime().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.utcSecond" /* i18n: Z・unit second（編集するとミリ秒は落ちる） */,
      ),
      unit: "second",
    }),
    utcMillisecond: z.iso.datetime().register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.utcMillisecond" /* i18n: Z・unit millisecond（ミリ秒まで書く） */,
      ),
      unit: "millisecond",
    }),
    utcPrecisionMinute: z.iso
      .datetime({ precision: -1 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.utcPrecisionMinute" /* i18n: Z・precision -1（分まで書く） */,
        ),
      }),
    utcPrecisionSecond: z.iso
      .datetime({ precision: 0 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.utcPrecisionSecond" /* i18n: Z・precision 0（秒まで書く） */,
        ),
      }),
    utcPrecisionMillisecond: z.iso
      .datetime({ precision: 3 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.utcPrecisionMillisecond" /* i18n: Z・precision 3（ミリ秒まで書く） */,
        ),
      }),
    localMinute: z.iso.datetime({ local: true }).register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.localMinute" /* i18n: local・unit minute（編集すると秒は 00、ミリ秒は落ちる） */,
      ),
      unit: "minute",
    }),
    localSecond: z.iso.datetime({ local: true }).register(zf.date.registry, {
      label: msgKey(
        "formDemo.date.localSecond" /* i18n: local・unit second（編集するとミリ秒は落ちる） */,
      ),
      unit: "second",
    }),
    localMillisecond: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.localMillisecond" /* i18n: local・unit millisecond（ミリ秒まで書く） */,
        ),
        unit: "millisecond",
      }),
    localPrecisionMinute: z.iso
      .datetime({ local: true, precision: -1 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.localPrecisionMinute" /* i18n: local・precision -1（分まで書く） */,
        ),
      }),
    localPrecisionSecond: z.iso
      .datetime({ local: true, precision: 0 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.localPrecisionSecond" /* i18n: local・precision 0（秒まで書く） */,
        ),
      }),
    localPrecisionMillisecond: z.iso
      .datetime({ local: true, precision: 3 })
      .register(zf.date.registry, {
        label: msgKey(
          "formDemo.date.localPrecisionMillisecond" /* i18n: local・precision 3（ミリ秒まで書く） */,
        ),
      }),
  })
  .register(zf.object.registry, {});

// 現在時刻
const now = new Date();
const nowEpoch = now.getTime();

export const defaultValues: z.input<typeof schema> = {
  // z.date() + timestamp
  dateDefault: now,
  dateMillisecond: now,
  dateMillisecondReadOnly: now,
  dateMinute: now,
  dateDay: now,
  dateMonth: now,
  dateYear: now,

  // z.date() + utcEncode
  dateUtcDefault: now,
  dateUtcMinute: now,
  dateUtcDay: now,
  dateUtcMonth: now,
  dateUtcYear: now,

  // z.number()
  numberDefault: nowEpoch,
  numberDay: nowEpoch,
  numberUtcEncode: nowEpoch,

  // z.iso.datetime()（各フィールドが書く形に合わせる）
  isoDatetimeDefault: `${now.toISOString().slice(0, 19)}Z`,
  isoDatetimeMinute: `${now.toISOString().slice(0, 16)}:00Z`,
  isoDatetimePrecisionMinute: `${now.toISOString().slice(0, 16)}Z`,
  isoDatetimePrecisionSecond: `${now.toISOString().slice(0, 19)}Z`,

  // z.iso.datetime({ local: true })
  isoDatetimeLocalDefault: formatLocalDateTime(now).slice(0, 19),
  isoDatetimeLocalMinute: `${formatLocalDateTime(now).slice(0, 16)}:00`,
  isoDatetimeLocalPrecisionMinute: formatLocalDateTime(now).slice(0, 16),

  // z.iso.date()
  isoDateDefault: formatIsoDate(now),
  isoDateMonth: formatIsoDate(now),
  isoDateYear: formatIsoDate(now),

  // precision・unit で書かれる形（固定の日時。開いた時刻にしない）
  utcMinute: "2026-03-14T09:26:53.589Z",
  utcSecond: "2026-03-14T09:26:53.589Z",
  utcMillisecond: "2026-03-14T09:26:53.589Z",
  utcPrecisionMinute: "2026-03-14T09:26Z",
  utcPrecisionSecond: "2026-03-14T09:26:53Z",
  utcPrecisionMillisecond: "2026-03-14T09:26:53.589Z",
  localMinute: "2026-03-14T09:26:53.589",
  localSecond: "2026-03-14T09:26:53.589",
  localMillisecond: "2026-03-14T09:26:53.589",
  localPrecisionMinute: "2026-03-14T09:26",
  localPrecisionSecond: "2026-03-14T09:26:53",
  localPrecisionMillisecond: "2026-03-14T09:26:53.589",
};

export type SchemaType = z.infer<typeof schema>;

// ヘルパー関数
function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, "0")}`;
}

function formatIsoDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
