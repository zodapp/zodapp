import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/objectLayout";

/** form-demo の日本語の辞書（objectLayout） */
export const ja = {
  "formDemo.page.objectLayout.title": "zf.object（並べ方）",
  "formDemo.page.objectLayout.description":
    "項目を横に並べる、枠で囲む、表示順を変える",
} satisfies MessagesOf<typeof en>;
