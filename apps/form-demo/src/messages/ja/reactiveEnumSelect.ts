import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveEnumSelect";

/** form-demo の日本語の辞書（reactiveEnumSelect） */
export const ja = {
  "formDemo.page.reactiveEnumSelect.description":
    "reactiveComponentLibrary によるEnum選択。array（複数選択）は非対応のため除外。",
} satisfies MessagesOf<typeof en>;
