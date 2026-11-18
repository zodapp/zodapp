import type { MessageDictionary, MessageValue } from "./types";

/** i18next の `t` などの形 */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

export type MessagesFromTranslatorOptions = {
  /**
   * キーの訳があるか。省略時は `t(key)` がキーと違う文字列を返せば「ある」とみなす
   * （i18next は訳が無いとキーをそのまま返す）。
   */
  exists?: (key: string) => boolean;
  /** 辞書のキーに足す接頭辞（`t` に渡すキーの名前空間を変えるとき）。既定は無し */
  keyPrefix?: string;
};

/**
 * i18next などの `t` 関数を、この仕組みの辞書として使えるようにする。
 *
 * 引かれたキーごとに `t(key, params)` を呼ぶ関数を返す。訳が無いキーは undefined を返し、
 * パッケージの既定の文言に落ちる。
 *
 * @example
 * <I18nMessagesProvider locale={i18n.language} messages={messagesFromTranslator(i18n.t)}>
 */
export const messagesFromTranslator = (
  t: Translator,
  options: MessagesFromTranslatorOptions = {},
): MessageDictionary => {
  const prefix = options.keyPrefix ?? "";
  const exists =
    options.exists ?? ((key: string) => t(key) !== key);
  const cache = new Map<string, MessageValue | undefined>();
  return new Proxy({} as Record<string, MessageValue | undefined>, {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      if (cache.has(property)) return cache.get(property);
      const key = prefix + property;
      const value: MessageValue | undefined = exists(key)
        ? (params: Record<string, unknown> = {}) => t(key, params)
        : undefined;
      cache.set(property, value);
      return value;
    },
  });
};
