import { z } from "zod";

// ============================================================
// 型定義
// ============================================================

/** 時刻の UI 上の精度 */
export type TimeUnit = "hour" | "minute" | "second" | "millisecond";

/** number で持つときのデータの持ち方（0 時からの経過量、整数） */
export type TimeEncoding =
  | "hoursOfDay"
  | "minutesOfDay"
  | "secondsOfDay"
  | "millisecondsOfDay";

/** `createTimeConverter()` が扱える Zod スキーマ */
export type SupportedTimeSchema = z.ZodISOTime | z.ZodNumber;

export type CreateTimeConverterParams = {
  schema: SupportedTimeSchema;
  /** UI 上の精度。省略時はデータの持ち方に合わせる */
  unit?: TimeUnit;
  /** number のデータの持ち方。省略時は secondsOfDay。string には指定できない */
  encoding?: TimeEncoding;
};

/**
 * 時刻の値と「ピッカーの文字列値」を相互変換するためのコンバータ。
 *
 * ピッカーの文字列は unit に応じて `HH:mm` / `HH:mm:ss` / `HH:mm:ss.SSS`。
 */
export type TimeConverter = {
  toPickerValue: (value: unknown) => string | null;
  fromPickerValue: (pickerValue: string | null) => unknown;
  /** 推論された（または指定された）unit */
  unit: TimeUnit;
  /**
   * ピッカーの文字列で受け付ける、秒の小数の桁数の上限。データが持てる桁数に合わせる
   * （string は precision の桁数、precision なしは制限なし（undefined）、number は 3）。
   * ミリ秒より細かい桁は値には入らない（0 として書く）
   */
  fractionDigits: number | undefined;
};

// ============================================================
// 定数
// ============================================================

const UNIT_RANK: Record<TimeUnit, number> = {
  hour: 0,
  minute: 1,
  second: 2,
  millisecond: 3,
};

const UNIT_MS: Record<TimeUnit, number> = {
  hour: 3_600_000,
  minute: 60_000,
  second: 1_000,
  millisecond: 1,
};

const ENCODING_UNIT: Record<TimeEncoding, TimeUnit> = {
  hoursOfDay: "hour",
  minutesOfDay: "minute",
  secondsOfDay: "second",
  millisecondsOfDay: "millisecond",
};

const DAY_MS = 86_400_000;

const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;

// ============================================================
// 内部関数
// ============================================================

function getIsoTimePrecision(schema: z.ZodISOTime): number | undefined {
  const precision = (schema._zod.def as { precision?: number | null })
    .precision;
  return typeof precision === "number" ? precision : undefined;
}

/** precision から、string が持てる一番細かい粒度を返す */
function precisionToUnit(precision: number | undefined): TimeUnit {
  if (precision === undefined) return "millisecond";
  if (precision < 0) return "minute";
  if (precision === 0) return "second";
  return "millisecond";
}

/** `HH:mm[:ss[.fraction]]` を 0 時からのミリ秒にする。読めなければ null */
function parseTimeString(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, hh, mm, ss, fraction] = match;
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = ss === undefined ? 0 : Number(ss);
  const millis =
    fraction === undefined ? 0 : Number(fraction.padEnd(3, "0").slice(0, 3));
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** 0 時からのミリ秒を、時・分・秒・ミリ秒に分ける */
function splitMs(ms: number) {
  return {
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1_000) % 60,
    millis: ms % 1000,
  };
}

/** unit の粒度で `HH:mm` / `HH:mm:ss` / `HH:mm:ss.SSS` に書く（hour は `HH:mm`） */
function formatByUnit(ms: number, unit: TimeUnit): string {
  const { hours, minutes, seconds, millis } = splitMs(ms);
  const hm = `${pad(hours)}:${pad(minutes)}`;
  if (unit === "hour" || unit === "minute") return hm;
  if (unit === "second") return `${hm}:${pad(seconds)}`;
  return `${hm}:${pad(seconds)}.${pad(millis, 3)}`;
}

/** precision の桁数で ISO の時刻文字列に書く。ミリ秒より細かい桁は 0 で埋める */
function formatByPrecision(ms: number, precision: number): string {
  const { hours, minutes, seconds, millis } = splitMs(ms);
  const hm = `${pad(hours)}:${pad(minutes)}`;
  if (precision < 0) return hm;
  const hms = `${hm}:${pad(seconds)}`;
  if (precision === 0) return hms;
  const fraction = pad(millis, 3).padEnd(precision, "0").slice(0, precision);
  return `${hms}.${fraction}`;
}

// ============================================================
// ファクトリ関数
// ============================================================

/**
 * 時刻のスキーマ向けの `TimeConverter` を生成します。timezone naive のみを扱います。
 *
 * - `z.iso.time()`: データの持ち方は zod の precision（-1: 分、0: 秒、1 以上: 秒の小数）。
 *   unit 省略時は precision から決める（-1 → minute、0 → second、1〜 → millisecond、
 *   precision なし → second）。precision なしで書くときは unit の粒度で書く
 *   （hour / minute / second は `HH:mm:ss`、millisecond は `HH:mm:ss.SSS`）。
 * - `z.number()`: 0 時からの経過量（整数）。encoding 省略時は secondsOfDay。unit 省略時は encoding と同じ粒度。
 *
 * unit をデータより細かくすると値に入らないので、定義の誤りとしてエラーを投げます。
 */
export function createTimeConverter(
  params: CreateTimeConverterParams,
): TimeConverter {
  const { schema } = params;
  const isString = schema instanceof z.ZodISOTime;
  const isNumber = schema instanceof z.ZodNumber;
  if (!isString && !isNumber) {
    throw new Error("zf.time requires z.iso.time() or z.number()");
  }
  if (isString && params.encoding !== undefined) {
    throw new Error(
      `zf.time: encoding is only for z.number(); use z.iso.time({ precision }) for strings (got "${params.encoding}")`,
    );
  }

  const precision = isString ? getIsoTimePrecision(schema) : undefined;
  const encoding: TimeEncoding = params.encoding ?? "secondsOfDay";
  const storageUnit: TimeUnit = isString
    ? precisionToUnit(precision)
    : ENCODING_UNIT[encoding];
  const defaultUnit: TimeUnit =
    isString && precision === undefined ? "second" : storageUnit;
  const unit = params.unit ?? defaultUnit;

  if (UNIT_RANK[unit] > UNIT_RANK[storageUnit]) {
    throw new Error(
      `zf.time: unit "${unit}" is finer than the stored value (${
        isString ? `precision ${precision}` : `encoding "${encoding}"`
      })`,
    );
  }

  const valueToMs = (value: unknown): number | null => {
    if (typeof value === "string") return parseTimeString(value);
    if (typeof value === "number" && Number.isFinite(value)) {
      const ms = Math.floor(value * UNIT_MS[ENCODING_UNIT[encoding]]);
      return ms >= 0 && ms < DAY_MS ? ms : null;
    }
    return null;
  };

  const msToValue = (ms: number): unknown => {
    if (!isString) return Math.floor(ms / UNIT_MS[ENCODING_UNIT[encoding]]);
    if (precision !== undefined) return formatByPrecision(ms, precision);
    return formatByUnit(ms, unit === "millisecond" ? "millisecond" : "second");
  };

  const toPickerValue = (value: unknown): string | null => {
    const ms = valueToMs(value);
    if (ms === null) return null;
    // 秒の小数が 3 桁より少ないデータは、その桁数で見せる（欄が受け付ける桁数と同じにする）
    if (
      unit === "millisecond" &&
      precision !== undefined &&
      precision >= 1 &&
      precision < 3
    ) {
      return formatByPrecision(ms, precision);
    }
    return formatByUnit(ms, unit);
  };

  const fromPickerValue = (pickerValue: string | null): unknown => {
    if (pickerValue == null || pickerValue === "") return undefined;
    const ms = parseTimeString(pickerValue);
    if (ms === null) return undefined;
    // UI の粒度より細かい部分は切り捨てる
    const truncated = ms - (ms % UNIT_MS[unit]);
    return msToValue(truncated);
  };

  const fractionDigits = !isString
    ? 3
    : precision === undefined
      ? undefined
      : Math.max(precision, 0);

  return { toPickerValue, fromPickerValue, unit, fractionDigits };
}
