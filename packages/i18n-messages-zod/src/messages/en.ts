import { defineMessages } from "@zodapp/i18n-messages";

type Bound = { inclusive: string };
type Min = Bound & { minimum: string };
type Max = Bound & { maximum: string };
type Format = {
  format?: string;
  pattern?: string;
  prefix?: string;
  suffix?: string;
  includes?: string;
};

const formatDate = (iso: string) => new Date(iso).toLocaleString("en-US");
const atLeast = (p: Bound) => (p.inclusive === "true" ? "at least" : "more than");
const atMost = (p: Bound) => (p.inclusive === "true" ? "at most" : "less than");

/** `zod.*` の英語の辞書（型の基準） */
export const en = defineMessages({
  "zod.required": "Required.",
  "zod.invalidType": (p: { expected: string; received: string }) =>
    `Expected ${p.expected}, received ${p.received}.`,
  "zod.invalidValue": (p: { values: string }) => `Expected one of: ${p.values}.`,
  "zod.tooSmall.string": (p: Min) => `Must be ${atLeast(p)} ${p.minimum} characters.`,
  "zod.tooSmall.number": (p: Min) => `Must be ${p.inclusive === "true" ? "greater than or equal to" : "greater than"} ${p.minimum}.`,
  "zod.tooSmall.bigint": (p: Min) => `Must be ${p.inclusive === "true" ? "greater than or equal to" : "greater than"} ${p.minimum}.`,
  "zod.tooSmall.array": (p: Min) => `Must have ${atLeast(p)} ${p.minimum} items.`,
  "zod.tooSmall.set": (p: Min) => `Must have ${atLeast(p)} ${p.minimum} items.`,
  "zod.tooSmall.file": (p: Min) => `File must be ${atLeast(p)} ${p.minimum} bytes.`,
  "zod.tooSmall.date": (p: Min) => `Must be ${p.inclusive === "true" ? "on or after" : "after"} ${formatDate(p.minimum)}.`,
  "zod.tooSmall.other": (p: Min) => `Must be ${atLeast(p)} ${p.minimum}.`,
  "zod.tooBig.string": (p: Max) => `Must be ${atMost(p)} ${p.maximum} characters.`,
  "zod.tooBig.number": (p: Max) => `Must be ${p.inclusive === "true" ? "less than or equal to" : "less than"} ${p.maximum}.`,
  "zod.tooBig.bigint": (p: Max) => `Must be ${p.inclusive === "true" ? "less than or equal to" : "less than"} ${p.maximum}.`,
  "zod.tooBig.array": (p: Max) => `Must have ${atMost(p)} ${p.maximum} items.`,
  "zod.tooBig.set": (p: Max) => `Must have ${atMost(p)} ${p.maximum} items.`,
  "zod.tooBig.file": (p: Max) => `File must be ${atMost(p)} ${p.maximum} bytes.`,
  "zod.tooBig.date": (p: Max) => `Must be ${p.inclusive === "true" ? "on or before" : "before"} ${formatDate(p.maximum)}.`,
  "zod.tooBig.other": (p: Max) => `Must be ${atMost(p)} ${p.maximum}.`,
  "zod.invalidFormat.email": "Enter a valid email address.",
  "zod.invalidFormat.url": "Enter a valid URL.",
  "zod.invalidFormat.uuid": "Enter a valid UUID.",
  "zod.invalidFormat.datetime": "Enter a valid ISO date and time.",
  "zod.invalidFormat.date": "Enter a valid ISO date.",
  "zod.invalidFormat.time": "Enter a valid ISO time.",
  "zod.invalidFormat.regex": (p: Format) => `Must match the pattern ${p.pattern ?? ""}.`,
  "zod.invalidFormat.startsWith": (p: Format) => `Must start with "${p.prefix ?? ""}".`,
  "zod.invalidFormat.endsWith": (p: Format) => `Must end with "${p.suffix ?? ""}".`,
  "zod.invalidFormat.includes": (p: Format) => `Must include "${p.includes ?? ""}".`,
  "zod.invalidFormat.other": (p: Format) => `Enter a valid ${p.format ?? "value"}.`,
  "zod.notMultipleOf": (p: { divisor: string }) => `Must be a multiple of ${p.divisor}.`,
  "zod.unrecognizedKeys": (p: { keys: string }) => `Unrecognized keys: ${p.keys}.`,
  "zod.invalidKey": (p: { origin: string }) => `Invalid key in ${p.origin}.`,
  "zod.invalidElement": (p: { origin: string }) => `Invalid value in ${p.origin}.`,
  // union の欄は、選んだ腕の欄にエラーを出すので、union 自身の文言は空にする
  "zod.invalidUnion": "",
  "zod.invalid": "Invalid input.",
});
