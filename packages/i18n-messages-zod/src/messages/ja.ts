import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

const formatDate = (iso: string) => new Date(iso).toLocaleString("ja-JP");

/** `zod.*` の日本語の辞書 */
export const ja = {
  "zod.required": "必ず入力してください。",
  "zod.invalidType": () => "無効な値です。修正してください。",
  "zod.invalidValue": () => "無効な値です。修正してください。",
  "zod.tooSmall.string": (p) =>
    p.inclusive === "true" ? `${p.minimum}文字以上で入力してください。` : `${p.minimum}文字より多く入力してください。`,
  "zod.tooSmall.number": (p) =>
    p.inclusive === "true" ? `${p.minimum}以上の数値を入力してください。` : `${p.minimum}より大きい数値を入力してください。`,
  "zod.tooSmall.bigint": (p) =>
    p.inclusive === "true" ? `${p.minimum}以上の数値を入力してください。` : `${p.minimum}より大きい数値を入力してください。`,
  "zod.tooSmall.array": (p) =>
    p.inclusive === "true" ? `${p.minimum}個以上の要素を設定する必要があります。` : `${p.minimum}個より多くの要素を設定する必要があります。`,
  "zod.tooSmall.set": (p) =>
    p.inclusive === "true" ? `${p.minimum}個以上の要素を設定する必要があります。` : `${p.minimum}個より多くの要素を設定する必要があります。`,
  "zod.tooSmall.file": (p) =>
    p.inclusive === "true" ? `${p.minimum}バイト以上のファイルを選んでください。` : `${p.minimum}バイトより大きいファイルを選んでください。`,
  "zod.tooSmall.date": (p) =>
    p.inclusive === "true" ? `${formatDate(p.minimum)} 以降の日時を入力してください。` : `${formatDate(p.minimum)} より後の日時を入力してください。`,
  "zod.tooSmall.other": () => "無効な入力です。",
  "zod.tooBig.string": (p) =>
    p.inclusive === "true" ? `${p.maximum}文字以下で入力してください。` : `${p.maximum}文字より少なく入力してください。`,
  "zod.tooBig.number": (p) =>
    p.inclusive === "true" ? `${p.maximum}以下の数値を入力してください。` : `${p.maximum}より小さい数値を入力してください。`,
  "zod.tooBig.bigint": (p) =>
    p.inclusive === "true" ? `${p.maximum}以下の数値を入力してください。` : `${p.maximum}より小さい数値を入力してください。`,
  "zod.tooBig.array": (p) =>
    p.inclusive === "true" ? `${p.maximum}個以下の要素を設定する必要があります。` : `${p.maximum}個より少ない要素を設定する必要があります。`,
  "zod.tooBig.set": (p) =>
    p.inclusive === "true" ? `${p.maximum}個以下の要素を設定する必要があります。` : `${p.maximum}個より少ない要素を設定する必要があります。`,
  "zod.tooBig.file": (p) =>
    p.inclusive === "true" ? `${p.maximum}バイト以下のファイルを選んでください。` : `${p.maximum}バイトより小さいファイルを選んでください。`,
  "zod.tooBig.date": (p) =>
    p.inclusive === "true" ? `${formatDate(p.maximum)} 以前の日時を入力してください。` : `${formatDate(p.maximum)} より前の日時を入力してください。`,
  "zod.tooBig.other": () => "無効な入力です。",
  "zod.invalidFormat.email": "有効なメールアドレスを入力してください。",
  "zod.invalidFormat.url": "有効なURLを入力してください。",
  "zod.invalidFormat.uuid": "有効なUUIDを入力してください。",
  "zod.invalidFormat.datetime": "有効なISO日時を入力してください。",
  "zod.invalidFormat.date": "有効なISO日付を入力してください。",
  "zod.invalidFormat.time": "有効なISO時刻を入力してください。",
  "zod.invalidFormat.regex": (p) => `パターン${p.pattern ?? ""}に一致する必要があります。`,
  "zod.invalidFormat.startsWith": (p) => `"${p.prefix ?? ""}"で始まる文字列を入力してください。`,
  "zod.invalidFormat.endsWith": (p) => `"${p.suffix ?? ""}"で終わる文字列を入力してください。`,
  "zod.invalidFormat.includes": (p) => `"${p.includes ?? ""}"を含む文字列を入力してください。`,
  "zod.invalidFormat.other": (p) => `${p.format ?? ""} の形式で入力してください。`,
  "zod.notMultipleOf": (p) => `数値は${p.divisor}の倍数を入力してください。`,
  "zod.unrecognizedKeys": (p) => `オブジェクトのキー '${p.keys}' が識別できません。`,
  "zod.invalidKey": (p) => `${p.origin}内の無効なキー`,
  "zod.invalidElement": (p) => `${p.origin}内の無効な値`,
  "zod.invalidUnion": "",
  "zod.invalid": "無効な入力です。",
} satisfies MessagesOf<typeof en>;
