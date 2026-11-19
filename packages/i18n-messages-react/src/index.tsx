import React, { createContext, useContext, useMemo } from "react";
import {
  createMsg,
  lookupFromDictionaries,
  type MessageDictionary,
  type Messages,
  type MsgFn,
} from "@zodapp/i18n-messages";

type I18nMessagesContextValue = {
  locale: string;
  /** 外側の Provider から順に並べた辞書（後ろが優先） */
  dictionaries: readonly MessageDictionary[];
};

const I18nMessagesContext = createContext<I18nMessagesContextValue>({
  locale: "en",
  dictionaries: [],
});

export type I18nMessagesProviderProps = {
  /** BCP 47 の言語タグ（"ja"、"en-US" など）。省略時は外側の Provider の値（無ければ "en"） */
  locale?: string;
  /**
   * 辞書。外側の Provider の辞書にマージされ、こちらが優先される。
   * 配列で渡すと、後ろが優先される。
   */
  messages?:
    | Messages
    | MessageDictionary
    | readonly (Messages | MessageDictionary)[];
  children?: React.ReactNode;
};

/**
 * 文言の辞書とロケールを配る Provider。
 *
 * Provider が無いときは locale が "en"、辞書は空で、各パッケージの既定の文言（英語）が使われる。
 *
 * @example
 * <I18nMessagesProvider locale="ja" messages={[formMantineJa, widgetJa, { "zodFormWidget.import.title": "取込" }]}>
 */
export const I18nMessagesProvider = ({
  locale,
  messages,
  children,
}: I18nMessagesProviderProps) => {
  const parent = useContext(I18nMessagesContext);
  const value = useMemo<I18nMessagesContextValue>(() => {
    const own = (
      messages === undefined
        ? []
        : Array.isArray(messages)
          ? messages
          : [messages]
    ) as MessageDictionary[];
    return {
      locale: locale ?? parent.locale,
      dictionaries: [...parent.dictionaries, ...own],
    };
  }, [locale, messages, parent]);
  return (
    <I18nMessagesContext.Provider value={value}>
      {children}
    </I18nMessagesContext.Provider>
  );
};

/**
 * 既定の辞書を持つ `useMsg` を作る。
 *
 * パッケージは自分の英語の辞書（と、引く必要のあるほかのパッケージの英語の辞書）を渡して hook を作り、
 * Provider の外でも英語で出せるようにする。
 * 引く順は Provider の辞書（内側が優先）→ 既定の辞書（後ろが優先）→ キーそのもの。
 *
 * @example
 * export const useMsg = createUseMsg(en);
 */
export const createUseMsg =
  (...defaults: MessageDictionary[]) =>
  (): MsgFn => {
    const { dictionaries } = useContext(I18nMessagesContext);
    return useMemo(
      () => createMsg(lookupFromDictionaries(...defaults, ...dictionaries)),
      [dictionaries],
    );
  };

/**
 * 文言を引く関数を返す hook（既定の辞書なし）。アプリが自分のキーに使う。
 *
 * @example
 * const msg = useMsg();
 * msg("myApp.submit" /* 送信 *\/);
 */
export const useMsg = createUseMsg();

/** Provider の locale を返す（無ければ "en"） */
export const useLocale = (): string => useContext(I18nMessagesContext).locale;
