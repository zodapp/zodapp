import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/tableView";

/** form-demo の日本語の辞書（tableView） */
export const ja = {
  "formDemo.page.tableView.title": "表（AutoTable）",
  "formDemo.page.tableView.description":
    "表での computed（行の値から計算）と dynamic のセル、string の選択式のラベル、valueAction、externalKey、日付・時刻の表示。見出しを押すと、列の種類ごとの基準で並べる（dynamic の列は並べ替えない）。選択肢に無い値のセルも出す",
} satisfies MessagesOf<typeof en>;
