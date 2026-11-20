import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/date";

/** form-demo の日本語の辞書（date） */
export const ja = {
  "formDemo.page.date.description":
    "日付・時刻の入力（様々なZod型、粒度、エンコーディング）。開いただけでは値を書き換えず、編集すると precision・unit で決まる形で書く。unit が保存値より粗い欄は、編集すると細かい部分が 0 になる",
} satisfies MessagesOf<typeof en>;
