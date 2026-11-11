import type { z } from "zod";
import { CorruptedDataError, DefinitionError, ValidationError } from "./errors";

/**
 * キーにできる値（§5.6）。
 */
export type KeyValue = string | number | boolean | Date | null;

/**
 * キーのフィールドのエンコード（§5.6）。エンコードと逆算は値と文字列だけで決まり、
 * Schemaは定義時にキーにできる種類かを確かめるためだけに使う。
 */
export type FieldEncoder = {
  /** 文字列だけを取るSchemaか（`beginsWith` を使えるか） */
  readonly isString: boolean;
  encode(value: unknown): string;
  decode(encoded: string): unknown;
};

/** 物理キーの区切り文字 */
export const SEPARATOR = "#";
/** 区切り文字の次の文字。範囲の上限の境界に使う */
export const SEPARATOR_NEXT = "$";

const ESCAPE = "$";
const ESCAPE_LIMIT = 0x24; // `$` 以下の文字をエスケープする
const ESCAPE_OFFSET = 0x30;
const EMPTY_STRING = "$/";

/** 文字列以外の型の識別子。`$` の次に置く。並び順は null < false < true < 数値 < Date < 文字列 */
const TAG_NULL = "%";
const TAG_FALSE = "(";
const TAG_TRUE = ")";
const TAG_NUMBER = "*";
const TAG_DATE = "+";
const TYPE_TAGS = TAG_NULL + TAG_FALSE + TAG_TRUE + TAG_NUMBER + TAG_DATE;

type AnySchema = z.core.$ZodType;

const defOf = (schema: AnySchema) =>
  (schema as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;

/** Zod Schemaの種類（`def.type`） */
export const schemaType = (schema: AnySchema): string =>
  defOf(schema).type as string;

// ---- 文字列 ----

export const encodeString = (value: string): string => {
  if (value === "") return EMPTY_STRING;
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    out +=
      code <= ESCAPE_LIMIT
        ? ESCAPE + String.fromCharCode(code + ESCAPE_OFFSET)
        : ch;
  }
  return out;
};

/**
 * 文字列の接頭辞のエンコード。`beginsWith` の条件に使う。
 * 空文字列の特別な表現は使わない（空の接頭辞はすべてに一致する）。
 */
export const encodeStringPrefix = (value: string): string =>
  value === "" ? "" : encodeString(value);

export const decodeString = (encoded: string): string => {
  if (encoded === EMPTY_STRING) return "";
  let out = "";
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i]!;
    if (ch === ESCAPE) {
      const next = encoded.charCodeAt(i + 1);
      const code = next - ESCAPE_OFFSET;
      if (Number.isNaN(next) || code < 0 || code > ESCAPE_LIMIT) {
        throw new CorruptedDataError(`invalid escape in key: ${encoded}`);
      }
      out += String.fromCharCode(code);
      i++;
    } else {
      const code = ch.charCodeAt(0);
      if (code <= ESCAPE_LIMIT) {
        throw new CorruptedDataError(`unescaped character in key: ${encoded}`);
      }
      out += ch;
    }
  }
  return out;
};

// ---- 数値 ----

const hex8 = (u: number) => u.toString(16).padStart(8, "0");

/**
 * IEEE754の64ビットを、符号なし整数として比べたときに数値の順になる形にする。
 * 整数と小数を区別せず、すべての数値をこの形で表す。
 */
export const encodeNumber = (n: number): string => {
  const view = new DataView(new ArrayBuffer(8)); // 既定でビッグエンディアン
  view.setFloat64(0, n === 0 ? 0 : n); // -0 を 0 にそろえる
  let hi = view.getUint32(0);
  let lo = view.getUint32(4);
  if (hi & 0x8000_0000) {
    hi = ~hi >>> 0; // 負：全ビット反転
    lo = ~lo >>> 0;
  } else {
    hi = (hi | 0x8000_0000) >>> 0; // 正：符号ビットを立てる
  }
  return ESCAPE + TAG_NUMBER + hex8(hi) + hex8(lo);
};

export const decodeNumber = (encoded: string): number => {
  if (!/^\$\*[0-9a-f]{16}$/.test(encoded)) {
    throw new CorruptedDataError(`invalid number key: ${encoded}`);
  }
  let hi = parseInt(encoded.slice(2, 10), 16);
  let lo = parseInt(encoded.slice(10, 18), 16);
  if (hi & 0x8000_0000) {
    hi = (hi & 0x7fff_ffff) >>> 0;
  } else {
    hi = ~hi >>> 0;
    lo = ~lo >>> 0;
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, hi);
  view.setUint32(4, lo);
  return view.getFloat64(0);
};

// ---- Date ----

const MIN_DATE = Date.parse("0000-01-01T00:00:00.000Z");
const MAX_DATE = Date.parse("9999-12-31T23:59:59.999Z");

const encodeDate = (date: Date): string => {
  const time = date.getTime();
  if (Number.isNaN(time)) {
    throw new ValidationError("invalid date in key");
  }
  // 年が 0000〜9999 の範囲外だと ISO文字列が `+010000-…` などの形になり、順序が崩れる
  if (time < MIN_DATE || time > MAX_DATE) {
    throw new ValidationError(
      `dates in keys must be between years 0000 and 9999: ${date.toISOString()}`,
    );
  }
  return ESCAPE + TAG_DATE + date.toISOString();
};

const decodeDate = (encoded: string): Date => {
  const iso = encoded.slice(2);
  const date = new Date(iso);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso) ||
    Number.isNaN(date.getTime())
  ) {
    throw new CorruptedDataError(`invalid date key: ${encoded}`);
  }
  return date;
};

// ---- 値と文字列の相互変換 ----

/** キーの値をエンコードする。型は値から判別する */
export const encodeKeyValue = (value: unknown): string => {
  if (value === null) return ESCAPE + TAG_NULL;
  switch (typeof value) {
    case "string":
      return encodeString(value);
    case "boolean":
      return ESCAPE + (value ? TAG_TRUE : TAG_FALSE);
    case "number":
      if (!Number.isFinite(value)) {
        throw new ValidationError(`numbers in keys must be finite: ${value}`);
      }
      return encodeNumber(value);
    default:
      if (value instanceof Date) return encodeDate(value);
      throw new ValidationError(
        `value of type ${typeof value} cannot be used in a key`,
      );
  }
};

/** エンコードされたキーの値を逆算する。`$` に続く1文字で型を判別する */
export const decodeKeyValue = (encoded: string): KeyValue => {
  if (encoded[0] === ESCAPE) {
    switch (encoded[1]) {
      case TAG_NULL:
      case TAG_FALSE:
      case TAG_TRUE:
        if (encoded.length !== 2) {
          throw new CorruptedDataError(`invalid key: ${encoded}`);
        }
        return encoded[1] === TAG_NULL ? null : encoded[1] === TAG_TRUE;
      case TAG_NUMBER:
        return decodeNumber(encoded);
      case TAG_DATE:
        return decodeDate(encoded);
    }
  }
  return decodeString(encoded);
};

/**
 * エンコードされた値の型が占める範囲。範囲条件を同じ型の値に限るために使う。
 * `high` が undefined なら、その型（文字列）は最後まで続く。
 */
export const typeRangeOf = (
  encoded: string,
): { low: string; high: string | undefined } => {
  const tag = encoded[0] === ESCAPE ? encoded[1] : undefined;
  if (tag !== undefined && TYPE_TAGS.includes(tag)) {
    return {
      low: ESCAPE + tag,
      high: ESCAPE + String.fromCharCode(tag.charCodeAt(0) + 1),
    };
  }
  return { low: EMPTY_STRING, high: undefined };
};

// ---- キーにできるSchema ----

const anyEncoder: FieldEncoder = {
  isString: false,
  encode: encodeKeyValue,
  decode: decodeKeyValue,
};

const stringEncoder: FieldEncoder = { ...anyEncoder, isString: true };

const isKeyLiteral = (v: unknown) =>
  v === null || ["string", "number", "boolean"].includes(typeof v);

export type EncoderOptions = {
  /** `.optional()` を許すか。Indexのキーでは許し、ベーステーブルのキーでは許さない */
  allowOptional?: boolean;
};

/**
 * フィールドのSchemaがキーにできる種類かを確かめる（§5.6）。
 * キーにできない種類のSchemaは、定義時のエラーにする。
 */
export const encoderFor = (
  schema: AnySchema,
  field: string,
  options: EncoderOptions = {},
): FieldEncoder => {
  const def = defOf(schema);
  switch (def.type) {
    case "string":
      return stringEncoder;
    case "enum": {
      const values = Object.values(def.entries as Record<string, unknown>);
      return values.every((v) => typeof v === "string")
        ? stringEncoder
        : anyEncoder;
    }
    case "literal": {
      const values = def.values as unknown[];
      if (!values.every(isKeyLiteral)) {
        throw new DefinitionError(
          `key field "${field}": only string, number, boolean or null literals can be used as keys`,
        );
      }
      return values.every((v) => typeof v === "string")
        ? stringEncoder
        : anyEncoder;
    }
    case "number":
    case "boolean":
    case "date":
    case "null":
      return anyEncoder;
    case "nullable":
      encoderFor(def.innerType as AnySchema, field, options);
      return anyEncoder;
    case "optional":
      if (!options.allowOptional) {
        throw new DefinitionError(
          `key field "${field}": optional fields cannot be used as table keys`,
        );
      }
      return encoderFor(def.innerType as AnySchema, field, options);
    case "readonly":
      return encoderFor(def.innerType as AnySchema, field, options);
    case "union": {
      const members = (def.options as AnySchema[]).map((m) =>
        encoderFor(m, field, options),
      );
      return members.every((m) => m.isString) ? stringEncoder : anyEncoder;
    }
    case "pipe":
    case "transform":
    case "default":
    case "prefault":
      throw new DefinitionError(
        `key field "${field}": ${String(def.type)} cannot be used as keys because it is ambiguous whether input or output is encoded`,
      );
    default:
      throw new DefinitionError(
        `key field "${field}": schema of type "${String(def.type)}" cannot be used as a key`,
      );
  }
};

/** UTF-8でのバイト数 */
export const utf8Length = (value: string): number => {
  let bytes = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
};

/**
 * DynamoDBの比較（UTF-8のバイト順）と同じ順序で文字列を比べる。
 * コードポイントの順はUTF-8のバイト順と一致する。
 */
export const compareKeyStrings = (a: string, b: string): number => {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const ca = ia.next();
    const cb = ib.next();
    if (ca.done || cb.done) {
      return ca.done ? (cb.done ? 0 : -1) : 1;
    }
    const diff = ca.value.codePointAt(0)! - cb.value.codePointAt(0)!;
    if (diff !== 0) return diff;
  }
};
