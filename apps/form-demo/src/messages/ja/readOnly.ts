import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/readOnly";

/** form-demo の日本語の辞書（readOnly） */
export const ja = {
  "formDemo.page.readOnly.title": "閲覧専用の表示",
  "formDemo.page.readOnly.description": "readOnlyモード",
} satisfies MessagesOf<typeof en>;
