import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveRecord";

/** form-demo の日本語の辞書（reactiveRecord） */
export const ja = {
  "formDemo.page.reactiveRecord.description":
    "z.record(z.string(), ...) によるキー・バリュー形式のフォーム。キー名がラベルになります。",
} satisfies MessagesOf<typeof en>;
