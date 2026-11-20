import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveReadOnly";

/** form-demo の日本語の辞書（reactiveReadOnly） */
export const ja = {
  "formDemo.page.reactiveReadOnly.title": "閲覧専用の表示 (Reactive)",
  "formDemo.page.reactiveReadOnly.description":
    "reactiveComponentLibrary によるreadOnlyモード。非対応型（bigint, tuple, array, discriminatedUnion）は除外。",
} satisfies MessagesOf<typeof en>;
