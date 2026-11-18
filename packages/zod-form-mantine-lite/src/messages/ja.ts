import "dayjs/locale/ja.js";
import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

/**
 * `zodFormMantineLite.*` の日本語の辞書。
 * import すると dayjs の ja ロケールも読み込む（日付の欄で locale "ja" を使うため）。
 */
export const ja = {
  "zodFormMantineLite.unlisted": "（不正な値）",
  "zodFormMantineLite.selectedItem": "選択済み項目",
  "zodFormMantineLite.open": ({ label }) => `${label}を開く`,
  "zodFormMantineLite.noOptions": "選択肢がありません",
  "zodFormMantineLite.nothingFound": "見つかりません",
  "zodFormMantineLite.clear": "クリア",
  "zodFormMantineLite.download": "ダウンロード",
  "zodFormMantineLite.fetchFailed": "取得できませんでした",
  "zodFormMantineLite.fetchFailedWithLabel": ({ label }) =>
    `${label}を取得できませんでした`,
  "zodFormMantineLite.retry": "再試行",
  "zodFormMantineLite.yes": "はい",
  "zodFormMantineLite.no": "いいえ",
} satisfies MessagesOf<typeof en>;
