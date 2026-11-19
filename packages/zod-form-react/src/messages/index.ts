import "./types";
import { en as zodEn, ja as zodJa } from "@zodapp/i18n-messages-zod/messages";
import { en as ownEn } from "./en";
import { ja as ownJa } from "./ja";

/**
 * zod-form-react の英語の辞書。zod の既定のエラー（`zod.*`）の辞書も含む。
 * `I18nMessagesProvider` の `messages` に渡す。
 */
export const en = { ...zodEn, ...ownEn };

/**
 * zod-form-react の日本語の辞書。zod の既定のエラー（`zod.*`）の辞書も含む。
 */
export const ja = { ...zodJa, ...ownJa };
