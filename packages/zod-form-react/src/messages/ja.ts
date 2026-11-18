import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";

/** `zodFormReact.*` の日本語の辞書 */
export const ja = {
  "zodFormReact.dynamic.loading": "読み込み中",
  "zodFormReact.dynamic.failed": "取得できませんでした",
  "zodFormReact.media.videoUnsupported":
    "お使いのブラウザは動画の再生に対応していません。",
  "zodFormReact.media.audioUnsupported":
    "お使いのブラウザは音声の再生に対応していません。",
} satisfies MessagesOf<typeof en>;
