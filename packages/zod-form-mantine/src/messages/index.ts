import "./types";
import {
  en as liteEn,
  ja as liteJa,
} from "@zodapp/zod-form-mantine-lite/messages";
import { en as ownEn } from "./en";
import { ja as ownJa } from "./ja";

/**
 * zod-form-mantine の英語の辞書。依存する zod-form-mantine-lite・zod-form-react（と zod の既定のエラー）の辞書も含む。
 * `I18nMessagesProvider` の `messages` に渡す。
 */
export const en = { ...liteEn, ...ownEn };

/**
 * zod-form-mantine の日本語の辞書。依存するパッケージの辞書も含む。
 * import すると dayjs の ja ロケールも読み込む。
 */
export const ja = { ...liteJa, ...ownJa };
