import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/e2eUnsupported";

/** form-demo の日本語の辞書（e2eUnsupported） */
export const ja = {
  "formDemo.page.e2eUnsupported.title": "e2e：扱えない型の注記",
  "formDemo.page.e2eUnsupported.description":
    "rest 付きの tuple・uiType と要素の型が合わない配列・object を要素に持つ set は、その欄の場所に「扱えません」の注記を出し、ほかの欄は描く。使えないキー名（. を含む）は「このキー名は使えません」と出し、record に保存されていた使えないキーは編集できない行として出す。z.promise() と async の refine があるので、送信は止まり、理由が出る",
} satisfies MessagesOf<typeof en>;
