import type React from "react";
import { SegmentedControl } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import {
  en as widgetEn,
  ja as widgetJa,
} from "@zodapp/zod-form-widget/messages";
import { en as formDemoEn, ja as formDemoJa } from "../messages";

export type AppLocale = "ja" | "en";

const LOCALE_STORAGE_KEY = "app-locale";

// zod-form-widget の辞書は、zod-form-mantine・mantine-lite・react と zod のエラーの辞書も含む
const messagesByLocale = {
  ja: [widgetJa, formDemoJa],
  en: [widgetEn, formDemoEn],
} as const;

/** 選んだ言語（localStorage に保存。既定は ja） */
export const useAppLocale = () =>
  useLocalStorage<AppLocale>({
    key: LOCALE_STORAGE_KEY,
    defaultValue: "ja",
    getInitialValueInEffect: false,
  });

/**
 * 選んだ言語の辞書を、ライブラリの部品に渡す。
 * 切り替えると、ライブラリの文言・zod のエラー・日付の表示と、アプリの文言（src/messages の辞書）が変わる
 */
export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [locale] = useAppLocale();
  return (
    <I18nMessagesProvider locale={locale} messages={messagesByLocale[locale]}>
      {children}
    </I18nMessagesProvider>
  );
};

/** ヘッダーに置く言語の切り替え */
export const LanguageSwitcher = () => {
  const [locale, setLocale] = useAppLocale();
  return (
    <SegmentedControl
      size="xs"
      value={locale}
      onChange={(value) => setLocale(value as AppLocale)}
      data={[
        { value: "ja", label: "日本語" },
        { value: "en", label: "English" },
      ]}
      aria-label="Language"
      data-testid="language-switcher"
    />
  );
};
