import type {
  MessageKey,
  MsgKeyArgs,
  MsgKeyParamValue,
} from "./types";

/** キーとして扱う文字列の形 */
const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

/** 文字列がキーの形か */
export const isMessageKeyLike = (key: string): boolean => KEY_PATTERN.test(key);

const encodeParamValue = (value: MsgKeyParamValue): string =>
  value instanceof Date ? value.toISOString() : String(value);

/**
 * キーと params を、型を確かめずに `key?a=1&b=2` の文字列に詰める。
 * ふつうは型付きの {@link msgKey} を使う。
 */
export const encodeMsgKey = (
  key: string,
  params?: Readonly<Record<string, MsgKeyParamValue | undefined>>,
): string => {
  if (!isMessageKeyLike(key)) {
    throw new Error(`encodeMsgKey: invalid key: ${JSON.stringify(key)}`);
  }
  if (!params) return key;
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.append(name, encodeParamValue(value));
  }
  const query = searchParams.toString();
  return query ? `${key}?${query}` : key;
};

/**
 * キーと params を `key?a=1&b=2`（URLSearchParams の書式）の文字列に詰める。
 *
 * zod のエラーの文言や、スキーマの meta の `label` などに渡し、表示するときに辞書で訳す。
 * キーは {@link RegisteredMessages} に登録されたものに限り、params は辞書の項目の型から決まる。
 *
 * @example
 * z.string().min(3, msgKey("myapp.nameTooShort" /* {length}文字以上で入力 *\/, { length: 3 }))
 * // → "myapp.nameTooShort?length=3"
 */
export const msgKey = <K extends MessageKey>(
  key: K,
  ...args: MsgKeyArgs<K>
): string =>
  encodeMsgKey(
    key,
    args[0] as Readonly<Record<string, MsgKeyParamValue>> | undefined,
  );

/** {@link parseMsgKey} の結果 */
export type ParsedMsgKey = {
  key: string;
  params: Record<string, string>;
};

/**
 * `key?a=1&b=2` の文字列をキーと params に分ける。キーの形でなければ undefined。
 */
export const parseMsgKey = (text: string): ParsedMsgKey | undefined => {
  const index = text.indexOf("?");
  const key = index === -1 ? text : text.slice(0, index);
  if (!isMessageKeyLike(key)) return undefined;
  const params: Record<string, string> = {};
  if (index !== -1) {
    for (const [name, value] of new URLSearchParams(text.slice(index + 1))) {
      params[name] = value;
    }
  }
  return { key, params };
};
