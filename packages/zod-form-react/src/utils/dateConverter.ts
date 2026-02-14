import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { z } from "zod";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================================
// 型定義
// ============================================================

/** 日付のみの粒度（時間を含まない） */
export type DateOnlyUnit = "year" | "month" | "day";

/** 時間を含む粒度 */
export type TimeOnlyUnit = "minute" | "second" | "millisecond";

/** すべての粒度 */
export type DateUnit = DateOnlyUnit | TimeOnlyUnit;

/**
 * 日付値と「ピッカーの文字列値」を相互変換するためのコンバータ。
 *
 * UI 側は `toPickerValue()` / `fromPickerValue()` を使って、
 * Zod スキーマ由来の値（Date/number/string など）を表示用に変換します。
 */
export type DateConverter = {
  toPickerValue: (value: unknown) => string | null;
  fromPickerValue: (pickerValue: string | null) => unknown;
  /** 推論された（または指定された）unit */
  unit: DateUnit;
};

/**
 * 値のエンコード方式。
 *
 * - `timestamp`: タイムゾーンを考慮した timestamp 表現（環境依存の変換が発生しうる）
 * - `utcEncode`: UTC に正規化して encode/decode する
 * - `native`: 文字列表現（ISO）をそのまま扱う
 */
export type DateEncoding = "timestamp" | "utcEncode" | "native";

type SchemaType =
  | "date"
  | "number"
  | "isoDatetime"
  | "isoDatetimeLocal"
  | "isoDate";

// サポートするスキーマ型のUnion
/**
 * `createDateConverter()` が扱える Zod 日付系スキーマの集合。
 *
 * これ以外のスキーマを渡した場合は、実行時にエラーとなります。
 */
export type SupportedDateSchema =
  | z.ZodDate
  | z.ZodNumber
  | z.ZodISODateTime
  | z.ZodISODate;

// ============================================================
// CreateDateConverterParams - スキーマ・Unit・Encoding の組み合わせ
// ============================================================

/**
 * CreateDateConverterParams
 *
 * - schema: サポートするZodスキーマ
 * - unit: 粒度（省略時はスキーマから自動推論）
 * - encoding: 省略時はスキーマから自動推論
 * - timezone: timestamp encoding 時のみ使用
 *
 * Unit 制約と自動推論のデフォルト値:
 * - z.date(), z.number(): 全 unit 使用可（デフォルト: second）
 * - z.iso.datetime(): TimeOnlyUnit のみ（デフォルト: second）
 * - z.iso.date(): DateOnlyUnit のみ（デフォルト: day）
 *
 * 注: millisecond は明示的に指定した場合のみ使用（readOnly 表示でミリ秒精度を維持）
 *
 * Encoding 制約と自動推論のデフォルト値:
 * - z.date(), z.number(): timestamp | utcEncode（デフォルト: timestamp）
 * - z.iso.datetime(): timestamp のみ
 * - z.iso.datetime({ local: true }): native のみ
 * - z.iso.date(): native のみ
 */
export type CreateDateConverterParams =
  // z.date() (全 unit, unit/encoding 省略可)
  | {
      schema: z.ZodDate;
      unit?: DateUnit;
      encoding?: "timestamp" | "utcEncode";
      timezone?: string;
    }
  // z.number() (全 unit, unit/encoding 省略可)
  | {
      schema: z.ZodNumber;
      unit?: DateUnit;
      encoding?: "timestamp" | "utcEncode";
      timezone?: string;
    }
  // z.iso.datetime() / z.iso.datetime({ local: true })
  // (TimeOnlyUnit のみ, unit/encoding 省略可)
  // 注意: TypeScript では local: true を型レベルで区別できないため、
  //       encoding は両方許可し、validateParams で実行時チェックする
  | {
      schema: z.ZodISODateTime;
      unit?: TimeOnlyUnit;
      encoding?: "timestamp" | "native";
      timezone?: string;
    }
  // z.iso.date() (DateOnlyUnit のみ, unit/encoding 省略可)
  | {
      schema: z.ZodISODate;
      unit?: DateOnlyUnit;
      encoding?: "native";
      timezone?: string; // native encoding では使用しないが、型の一貫性のため
    };

// ============================================================
// Mantine フォーマット定数
// ============================================================

const MANTINE_DATE_FORMAT = "YYYY-MM-DD";
const MANTINE_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const MANTINE_DATETIME_MS_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS";

function pickerFormat(unit: DateUnit): string {
  if (unit === "millisecond") return MANTINE_DATETIME_MS_FORMAT;
  if (unit === "minute" || unit === "second") return MANTINE_DATETIME_FORMAT;
  return MANTINE_DATE_FORMAT;
}

// ============================================================
// Schema 判定
// ============================================================

function detectSchemaType(schema: SupportedDateSchema): SchemaType {
  // ZodDate
  if (schema instanceof z.ZodDate) {
    return "date";
  }

  // ZodNumber
  if (schema instanceof z.ZodNumber) {
    return "number";
  }

  // ZodISODateTime (z.iso.datetime() / z.iso.datetime({ local: true }))
  if (schema instanceof z.ZodISODateTime) {
    // local: true → isoDatetimeLocal, otherwise isoDatetime
    return schema._zod.def.local === true ? "isoDatetimeLocal" : "isoDatetime";
  }

  // ZodISODate (z.iso.date())
  if (schema instanceof z.ZodISODate) {
    return "isoDate";
  }

  // TypeScript の exhaustive check
  const _exhaustive: never = schema;
  throw new Error(`Unsupported schema type: ${_exhaustive}`);
}

// ============================================================
// 実行時バリデーション（registry の型制約が緩いため必要）
// ============================================================

const DATE_ONLY_UNITS: readonly DateOnlyUnit[] = ["year", "month", "day"];
const TIME_ONLY_UNITS: readonly TimeOnlyUnit[] = [
  "minute",
  "second",
  "millisecond",
];

function isDateOnlyUnit(unit: DateUnit): unit is DateOnlyUnit {
  return (DATE_ONLY_UNITS as readonly string[]).includes(unit);
}

function isTimeOnlyUnit(unit: DateUnit): unit is TimeOnlyUnit {
  return (TIME_ONLY_UNITS as readonly string[]).includes(unit);
}

/**
 * スキーマと unit/encoding の組み合わせを実行時に検証する
 *
 * registry のメタスキーマは Zod 型非依存のため、型レベルでは制約できない。
 * このためコンポーネントが createDateConverter を呼び出す前に、
 * 不正な組み合わせをここで検出してエラーをスローする。
 */
function validateParams(
  schemaType: SchemaType,
  unit: DateUnit,
  encoding: DateEncoding,
): void {
  // Unit 制約
  if (schemaType === "isoDatetime" || schemaType === "isoDatetimeLocal") {
    if (!isTimeOnlyUnit(unit)) {
      throw new Error(
        `z.iso.datetime() requires TimeOnlyUnit ("minute" | "second" | "millisecond"), but got "${unit}"`,
      );
    }
  }
  if (schemaType === "isoDate") {
    if (!isDateOnlyUnit(unit)) {
      throw new Error(
        `z.iso.date() requires DateOnlyUnit ("year" | "month" | "day"), but got "${unit}"`,
      );
    }
  }

  // Encoding 制約
  if (schemaType === "date" || schemaType === "number") {
    if (encoding !== "timestamp" && encoding !== "utcEncode") {
      throw new Error(
        `z.date() / z.number() requires encoding "timestamp" | "utcEncode", but got "${encoding}"`,
      );
    }
  }
  if (schemaType === "isoDatetime") {
    if (encoding !== "timestamp") {
      throw new Error(
        `z.iso.datetime() requires encoding "timestamp", but got "${encoding}"`,
      );
    }
  }
  if (schemaType === "isoDatetimeLocal") {
    if (encoding !== "native") {
      throw new Error(
        `z.iso.datetime({ local: true }) requires encoding "native", but got "${encoding}"`,
      );
    }
  }
  if (schemaType === "isoDate") {
    if (encoding !== "native") {
      throw new Error(
        `z.iso.date() requires encoding "native", but got "${encoding}"`,
      );
    }
  }
}

// ============================================================
// ファクトリ関数
// ============================================================

/**
 * 日付系スキーマ向けの `DateConverter` を生成します。
 *
 * スキーマ型に応じて `unit` / `encoding` を自動推論し、ピッカー文字列との相互変換関数を返します。
 * `encoding=\"timestamp\"` の場合はタイムゾーンが必要で、未指定なら `getDefaultTimezone()` にフォールバックします。
 */
export function createDateConverter(
  params: CreateDateConverterParams,
): DateConverter {
  const { schema } = params;
  const schemaType = detectSchemaType(schema);
  // unit が未指定の場合はスキーマから推論
  const unit = params.unit ?? inferDefaultUnit(schema);
  // encoding が未指定の場合はスキーマから推論
  const encoding = params.encoding ?? inferDefaultEncoding(schema);

  // 実行時バリデーション（registry の型制約が緩いため必要）
  validateParams(schemaType, unit, encoding);

  // timestamp encoding では timezone が必須だが、未指定時はシステムデフォルトにフォールバック
  const tz =
    encoding === "timestamp"
      ? params.timezone || getDefaultTimezone()
      : getDefaultTimezone(); // 他の encoding でも dayjs.tz を使う可能性があるためデフォルトを設定
  const format = pickerFormat(unit);

  // --------------------------------------------------------
  // pickerToDayjs: Mantine文字列 → dayjs
  // --------------------------------------------------------
  const pickerToDayjs = (pickerValue: string): dayjs.Dayjs | null => {
    try {
      // millisecond unit の場合、Mantine DateTimePicker は .SSS なしの値を返すことがある
      // その場合は .000 を補完してパースする
      let normalizedValue = pickerValue;
      if (unit === "millisecond" && !pickerValue.includes(".")) {
        normalizedValue = `${pickerValue}.000`;
      }

      let d: dayjs.Dayjs;

      switch (encoding) {
        case "timestamp":
          // UI の timezone で解釈して Instant 化
          d = dayjs.tz(normalizedValue, format, tz);
          break;
        case "utcEncode":
          // 見た目を UTC として解釈（タイムドリフト）
          d = dayjs.utc(normalizedValue, format, true);
          break;
        case "native":
          // ローカルとして解釈
          d = dayjs(normalizedValue, format, true);
          break;
      }

      return d.isValid() ? d : null;
    } catch {
      // dayjs.tz が無効な値でエラーを投げる場合がある
      return null;
    }
  };

  // --------------------------------------------------------
  // formatValue: dayjs → 保存形式（schema の型に応じて）
  // --------------------------------------------------------
  const formatValue = (d: dayjs.Dayjs): unknown => {
    switch (schemaType) {
      case "date":
        return d.toDate();
      case "number":
        return d.valueOf();
      case "isoDatetime":
        return d.toISOString(); // "YYYY-MM-DDTHH:mm:ss.SSSZ"
      case "isoDatetimeLocal":
        return d.format("YYYY-MM-DDTHH:mm:ss.SSS"); // オフセットなし
      case "isoDate":
        return d.format("YYYY-MM-DD");
    }
  };

  // --------------------------------------------------------
  // valueToDayjs: 保存値 → dayjs
  // --------------------------------------------------------
  const valueToDayjs = (value: unknown): dayjs.Dayjs | null => {
    if (value == null) return null;

    switch (schemaType) {
      case "date":
      case "number":
        // Date または epoch ms
        if (encoding === "timestamp") {
          return dayjs(value as Date | number).tz(tz);
        }
        // utcEncode: UTC として解釈
        return dayjs.utc(value as Date | number);

      case "isoDatetime":
        // "YYYY-MM-DDTHH:mm:ss.SSSZ" → timestamp encoding のみ
        return dayjs(value as string).tz(tz);

      case "isoDatetimeLocal":
        // "YYYY-MM-DDTHH:mm:ss" → native encoding
        return dayjs(value as string);

      case "isoDate":
        // "YYYY-MM-DD" → native encoding
        return dayjs(value as string);
    }
  };

  // --------------------------------------------------------
  // formatPicker: dayjs → Mantine文字列
  // --------------------------------------------------------
  const formatPicker = (d: dayjs.Dayjs): string => {
    return d.format(format);
  };

  // --------------------------------------------------------
  // toPickerValue / fromPickerValue
  // --------------------------------------------------------
  const toPickerValue = (value: unknown): string | null => {
    const d = valueToDayjs(value);
    if (!d) return null;
    return formatPicker(d);
  };

  const fromPickerValue = (pickerValue: string | null): unknown => {
    if (pickerValue == null || pickerValue === "") {
      return undefined;
    }
    const d = pickerToDayjs(pickerValue);
    if (!d) return undefined;
    return formatValue(d);
  };

  return { toPickerValue, fromPickerValue, unit };
}

// ============================================================
// デフォルトタイムゾーン取得
// ============================================================

/**
 * 実行環境（ブラウザ等）のデフォルトタイムゾーン名を取得します。
 */
export function getDefaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ============================================================
// デフォルト unit 推論（内部関数）
// ============================================================

/**
 * スキーマの型からデフォルトの unit を推論する
 *
 * - z.date(), z.number(), z.iso.datetime() → "second"
 * - z.iso.date() → "day"
 *
 * 注: millisecond は明示的に指定した場合のみ使用（readOnly 表示でミリ秒精度を維持）
 */
function inferDefaultUnit(schema: SupportedDateSchema): DateUnit {
  if (schema instanceof z.ZodISODate) {
    return "day";
  }
  // ZodDate, ZodNumber, ZodISODateTime はデフォルト second
  return "second";
}

// ============================================================
// デフォルト encoding 推論（内部関数）
// ============================================================

/**
 * スキーマの型からデフォルトの encoding を推論する
 *
 * - z.iso.datetime({ local: true }) → "native"
 * - z.iso.datetime() → "timestamp"
 * - z.iso.date() → "native"
 * - z.date(), z.number() → "timestamp"
 */
function inferDefaultEncoding(schema: SupportedDateSchema): DateEncoding {
  if (schema instanceof z.ZodISODateTime) {
    return schema._zod.def.local === true ? "native" : "timestamp";
  }
  if (schema instanceof z.ZodISODate) {
    return "native";
  }
  // ZodDate, ZodNumber はデフォルト timestamp
  return "timestamp";
}
