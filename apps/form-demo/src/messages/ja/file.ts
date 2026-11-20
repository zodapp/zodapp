import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/file";

/** form-demo の日本語の辞書（file） */
export const ja = {
  "formDemo.page.file.description":
    "ファイルを添付してプレビューする。保存先は差し替えられる",
} satisfies MessagesOf<typeof en>;
