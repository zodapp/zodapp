import "./types";
import {
  en as mantineEn,
  ja as mantineJa,
} from "@zodapp/zod-form-mantine/messages";
import { en as ownEn } from "./en";
import { ja as ownJa } from "./ja";

/**
 * zod-form-widget の英語の辞書。依存する zod-form-mantine・zod-form-mantine-lite・zod-form-react（と zod の既定のエラー）の辞書も含む。
 * `I18nMessagesProvider` の `messages` に渡す。
 */
export const en = { ...mantineEn, ...ownEn };

/**
 * zod-form-widget の日本語の辞書。依存するパッケージの辞書も含む。
 */
export const ja = { ...mantineJa, ...ownJa };
