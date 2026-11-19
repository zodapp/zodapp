import { parseMsgKey } from "./msgKey";
import type {
  MessageArgs,
  MessageDictionary,
  MessageKey,
  MessageValue,
} from "./types";

/** キーから辞書の値を引く関数。無ければ undefined */
export type MessageLookup = (key: string) => MessageValue | undefined;

/**
 * 文言を引く関数。
 *
 * - `msg(key, params?)`: 登録されたキーの文言を返す。辞書に無ければキーをそのまま返す
 * - `msg.resolve(text)`: `msgKey` で詰めた文字列なら訳し、そうでなければそのまま返す
 */
export type MsgFn = {
  <K extends MessageKey>(key: K, ...args: MessageArgs<K>): string;
  resolve: {
    (text: string): string;
    (text: string | undefined): string | undefined;
  };
};

const applyValue = (value: MessageValue, params: unknown): string =>
  typeof value === "function" ? value(params ?? {}) : value;

/** 辞書（後ろが優先）から {@link MessageLookup} を作る */
export const lookupFromDictionaries =
  (...dictionaries: (MessageDictionary | undefined)[]): MessageLookup =>
  (key) => {
    for (let i = dictionaries.length - 1; i >= 0; i--) {
      const dictionary = dictionaries[i];
      if (!dictionary) continue;
      // Object.prototype から継いだもの（toString など）は辞書の項目にしない。
      // messagesFromTranslator の Proxy は自分のキーを持たないので、継いだ名前でなければ引く
      if (!Object.hasOwn(dictionary, key) && key in Object.prototype) continue;
      const value = dictionary[key];
      if (value !== undefined) return value;
    }
    return undefined;
  };

/**
 * `msgKey` で詰めた文字列を辞書で訳す。キーの形でない、または辞書に無いときはそのまま返す。
 */
export const resolveMsg = (
  lookup: MessageLookup | MessageDictionary,
  text: string,
): string => {
  const find =
    typeof lookup === "function" ? lookup : lookupFromDictionaries(lookup);
  const parsed = parseMsgKey(text);
  if (!parsed) return text;
  const value = find(parsed.key);
  if (value === undefined) return text;
  return applyValue(value, parsed.params);
};

/** {@link MessageLookup} から {@link MsgFn} を作る */
export const createMsg = (lookup: MessageLookup): MsgFn => {
  const msg = (key: string, params?: unknown) => {
    const value = lookup(key);
    if (value === undefined) return key;
    return applyValue(value, params);
  };
  const resolve = (text: string | undefined) =>
    text === undefined ? undefined : resolveMsg(lookup, text);
  return Object.assign(msg, { resolve }) as unknown as MsgFn;
};

/**
 * 辞書を定義する。中身はそのまま返し、params の型を推論させるだけ。
 *
 * 基準にする辞書（型を {@link MessagesOf} で登録する辞書）に使う。
 * ほかの言語の辞書は `satisfies MessagesOf<typeof base>` で、キーのそろいと params の型を確かめる。
 */
export const defineMessages = <T extends Record<string, MessageValue>>(
  messages: T,
): T => messages;
