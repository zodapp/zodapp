import { encodeMsgKey } from "@zodapp/i18n-messages";
import type { z } from "zod";

type RawIssue = z.core.$ZodRawIssue;
type Params = Record<string, string | number | boolean | Date | undefined>;

/** 受け取った値の型の名前（`zod.invalidType` の `received`） */
const receivedType = (input: unknown): string => {
  if (input === null) return "null";
  if (input === undefined) return "undefined";
  if (Array.isArray(input)) return "array";
  if (input instanceof Date)
    return Number.isNaN(input.getTime()) ? "invalid_date" : "date";
  if (typeof input === "number" && Number.isNaN(input)) return "nan";
  return typeof input;
};

const SIZE_ORIGINS: Record<string, string> = {
  string: "string",
  number: "number",
  int: "number",
  bigint: "bigint",
  array: "array",
  set: "set",
  file: "file",
  date: "date",
};

const sizeValue = (origin: string, value: number | bigint): string | Date =>
  origin === "date" ? new Date(Number(value)) : String(value);

const FORMATS: Record<string, string> = {
  email: "email",
  url: "url",
  uuid: "uuid",
  guid: "uuid",
  datetime: "datetime",
  date: "date",
  time: "time",
  regex: "regex",
  starts_with: "startsWith",
  ends_with: "endsWith",
  includes: "includes",
};

// bigint は JSON.stringify で投げるので、文字列にしてから詰める
const formatValue = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "bigint"
      ? value.toString()
      : (JSON.stringify(value, (_key, v: unknown) =>
          typeof v === "bigint" ? v.toString() : v,
        ) ?? String(value));

/** issue を `zod.*` のキーと params にする */
export const zodIssueToMsgKey = (
  issue: RawIssue,
): [key: string, params?: Params] => {
  switch (issue.code) {
    case "invalid_type":
    case "invalid_value":
      if (issue.input === undefined || issue.input === null) {
        return issue.code === "invalid_type"
          ? ["zod.required", { expected: String(issue.expected) }]
          : ["zod.required"];
      }
      if (issue.code === "invalid_type") {
        return [
          "zod.invalidType",
          {
            expected: String(issue.expected),
            received: receivedType(issue.input),
          },
        ];
      }
      return [
        "zod.invalidValue",
        { values: issue.values.map(formatValue).join(", ") },
      ];
    case "too_small": {
      const origin = SIZE_ORIGINS[issue.origin] ?? "other";
      return [
        `zod.tooSmall.${origin}`,
        {
          minimum: sizeValue(origin, issue.minimum),
          inclusive: issue.inclusive ?? false,
        },
      ];
    }
    case "too_big": {
      const origin = SIZE_ORIGINS[issue.origin] ?? "other";
      return [
        `zod.tooBig.${origin}`,
        {
          maximum: sizeValue(origin, issue.maximum),
          inclusive: issue.inclusive ?? false,
        },
      ];
    }
    case "invalid_format": {
      const format = FORMATS[issue.format] ?? "other";
      const extra = issue as unknown as {
        prefix?: string;
        suffix?: string;
        includes?: string;
      };
      return [
        `zod.invalidFormat.${format}`,
        {
          format: issue.format,
          pattern: issue.pattern,
          prefix: extra.prefix,
          suffix: extra.suffix,
          includes: extra.includes,
        },
      ];
    }
    case "not_multiple_of":
      return ["zod.notMultipleOf", { divisor: String(issue.divisor) }];
    case "unrecognized_keys":
      return ["zod.unrecognizedKeys", { keys: issue.keys.join(", ") }];
    case "invalid_key":
      return ["zod.invalidKey", { origin: issue.origin }];
    case "invalid_element":
      return ["zod.invalidElement", { origin: issue.origin }];
    case "invalid_union":
      return ["zod.invalidUnion"];
    default:
      return ["zod.invalid"];
  }
};

/**
 * zod の既定のエラーを、`zod.*` のキーと params を詰めた文字列（`msgKey` の書式）にするエラーマップ。
 *
 * スキーマに直接書いた文言（`.min(3, "…")` や `msgKey(...)`）はこのマップより優先される。
 * 表示するときに `msg.resolve` で `@zodapp/i18n-messages-zod/messages` の辞書を引いて訳す。
 *
 * @example
 * schema.safeParse(value, { error: zodMsgKeyErrorMap });
 */
export const zodMsgKeyErrorMap: z.core.$ZodErrorMap = (issue) => {
  const [key, params] = zodIssueToMsgKey(issue);
  return { message: encodeMsgKey(key, params) };
};
