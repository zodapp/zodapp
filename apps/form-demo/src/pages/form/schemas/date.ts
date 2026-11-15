import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconCalendar } from "@tabler/icons-react";

export const formId = "date";
export const title = "zf.date";
export const description =
  "日付・時刻の入力（様々なZod型、粒度、エンコーディング）";
export const icon = IconCalendar;
export const category = "Basic";

export const schema = z
  .object({
    // ============================================================
    // 1.1 z.date() + timestamp（TZ非依存・デフォルト）
    // ============================================================
    dateDefault: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - デフォルト（second）",
    }),
    dateMillisecond: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示）",
      unit: "millisecond",
    }),
    dateMillisecondReadOnly: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - ミリ秒（millisecond, readOnlyでのみ表示）",
      unit: "millisecond",
      readOnly: true,
    }),
    dateMinute: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - 分単位（minute）",
      unit: "minute",
    }),
    dateDay: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - 日単位（day）",
      unit: "day",
    }),
    dateMonth: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - 月単位（month）",
      unit: "month",
    }),
    dateYear: z.date().register(zf.date.registry, {
      label: "z.date() timestamp - 年単位（year）",
      unit: "year",
    }),

    // ============================================================
    // 1.2 z.date() + utcEncode（タイムドリフト）
    // ユーザー入力をUTC基準でエンコード（TZ依存の日付をInstantで保存）
    // ============================================================
    dateUtcDefault: z.date().register(zf.date.registry, {
      label: "z.date() utcEncode - デフォルト（second）",
      encoding: "utcEncode",
    }),
    dateUtcMinute: z.date().register(zf.date.registry, {
      label: "z.date() utcEncode - 分単位（minute）",
      unit: "minute",
      encoding: "utcEncode",
    }),
    dateUtcDay: z.date().register(zf.date.registry, {
      label: "z.date() utcEncode - 日単位（day）",
      unit: "day",
      encoding: "utcEncode",
    }),
    dateUtcMonth: z.date().register(zf.date.registry, {
      label: "z.date() utcEncode - 月単位（month）",
      unit: "month",
      encoding: "utcEncode",
    }),
    dateUtcYear: z.date().register(zf.date.registry, {
      label: "z.date() utcEncode - 年単位（year）",
      unit: "year",
      encoding: "utcEncode",
    }),

    // ============================================================
    // 2. z.number() - Unix epoch ms
    // ============================================================
    numberDefault: z.number().register(zf.date.registry, {
      label: "z.number() - デフォルト（second, timestamp）",
    }),
    numberDay: z.number().register(zf.date.registry, {
      label: "z.number() - 日単位（day）",
      unit: "day",
    }),
    numberUtcEncode: z.number().register(zf.date.registry, {
      label: "z.number() - UTCエンコード（utcEncode）",
      unit: "day",
      encoding: "utcEncode",
    }),

    // ============================================================
    // 3. z.iso.datetime() - ISO datetime with Z (TZ非依存)
    // ============================================================
    isoDatetimeDefault: z.iso.datetime().register(zf.date.registry, {
      label: "z.iso.datetime() - デフォルト（second, timestamp）",
    }),
    isoDatetimeMinute: z.iso.datetime().register(zf.date.registry, {
      label: "z.iso.datetime() - 分単位（minute）",
      unit: "minute",
    }),
    // precision はデータの持ち方。値を変えたときだけ、その形式で書く（開いただけでは触らない）
    isoDatetimePrecisionMinute: z.iso
      .datetime({ precision: -1 })
      .register(zf.date.registry, {
        label:
          'z.iso.datetime({ precision: -1 }) - データは分まで（"2026-11-14T02:30Z"）、unit も minute',
      }),
    isoDatetimePrecisionSecond: z.iso
      .datetime({ precision: 0 })
      .register(zf.date.registry, {
        label: "z.iso.datetime({ precision: 0 }) - データは秒まで",
      }),

    // ============================================================
    // 4. z.iso.datetime({ local: true }) - ISO datetime local (TZ依存)
    // ============================================================
    isoDatetimeLocalDefault: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: "z.iso.datetime({ local: true }) - デフォルト（second, native）",
      }),
    isoDatetimeLocalMinute: z.iso
      .datetime({ local: true })
      .register(zf.date.registry, {
        label: "z.iso.datetime({ local: true }) - 分単位（minute）",
        unit: "minute",
      }),
    isoDatetimeLocalPrecisionMinute: z.iso
      .datetime({ local: true, precision: -1 })
      .register(zf.date.registry, {
        label:
          'z.iso.datetime({ local: true, precision: -1 }) - データは分まで（"2026-11-14T11:30"）',
      }),

    // ============================================================
    // 5. z.iso.date() - ISO date (TZ依存)
    // ============================================================
    isoDateDefault: z.iso.date().register(zf.date.registry, {
      label: "z.iso.date() - デフォルト（day, native）",
    }),
    isoDateMonth: z.iso.date().register(zf.date.registry, {
      label: "z.iso.date() - 月単位（month）",
      unit: "month",
    }),
    isoDateYear: z.iso.date().register(zf.date.registry, {
      label: "z.iso.date() - 年単位（year）",
      unit: "year",
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

  // z.iso.datetime()
  isoDatetimeDefault: now.toISOString(),
  isoDatetimeMinute: now.toISOString(),
  isoDatetimePrecisionMinute: `${now.toISOString().slice(0, 16)}Z`,
  isoDatetimePrecisionSecond: `${now.toISOString().slice(0, 19)}Z`,

  // z.iso.datetime({ local: true })
  isoDatetimeLocalDefault: formatLocalDateTime(now),
  isoDatetimeLocalMinute: formatLocalDateTime(now),
  isoDatetimeLocalPrecisionMinute: formatLocalDateTime(now).slice(0, 16),

  // z.iso.date()
  isoDateDefault: formatIsoDate(now),
  isoDateMonth: formatIsoDate(now),
  isoDateYear: formatIsoDate(now),
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
