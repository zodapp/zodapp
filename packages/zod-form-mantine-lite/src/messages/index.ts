import "./types";
import { en as reactEn, ja as reactJa } from "@zodapp/zod-form-react/messages";
import { en as ownEn } from "./en";
import { ja as ownJa } from "./ja";

/**
 * zod-form-mantine-lite の英語の辞書。依存する zod-form-react（と zod の既定のエラー）の辞書も含む。
 * `I18nMessagesProvider` の `messages` に渡す。
 */
export const en = { ...reactEn, ...ownEn };

/**
 * zod-form-mantine-lite の日本語の辞書。依存する zod-form-react（と zod の既定のエラー）の辞書も含む。
 * import すると dayjs の ja ロケールも読み込む。
 */
export const ja = { ...reactJa, ...ownJa };
