import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveBasicInput";

/** form-demo の日本語の辞書（reactiveBasicInput） */
export const ja = {
  "formDemo.page.reactiveBasicInput.title": "基本 (Reactive)",
  "formDemo.page.reactiveBasicInput.description":
    "reactiveComponentLibrary による基本入力。フィールド単位の確認UIあり。",
} satisfies MessagesOf<typeof en>;
