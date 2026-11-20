import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/tableView";

/** form-demo の日本語の辞書（tableView） */
export const ja = {
  "formDemo.page.tableView.title": "表（AutoTable）",
  "formDemo.page.tableView.description":
    "表での computed（行の値から計算）と dynamic のセル、string の選択式のラベル、valueAction、externalKey、日付・時刻の表示。見出しを押すと、列の種類ごとの基準で並べる（dynamic の列は並べ替えない）。選択肢に無い値のセルも出す",
  "formDemo.tableView.amountSchema.resolve.schema": "金額",
  "formDemo.tableView.office": "拠点（select）",
  "formDemo.tableView.status.todo": "未着手",
  "formDemo.tableView.status.open": "対応中",
  "formDemo.tableView.status.done": "完了",
  "formDemo.tableView.status": "状態（valueAction）",
  "formDemo.tableView.assignee": "担当（externalKey）",
  "formDemo.tableView.due": "期限",
  "formDemo.tableView.start": "開始（time）",
  "formDemo.tableView.unitPrice": "単価",
  "formDemo.tableView.quantity": "数量",
  "formDemo.tableView.total": "小計（computed）",
  "formDemo.tableView.currency.JPY": "円",
  "formDemo.tableView.currency.USD": "ドル",
  "formDemo.tableView.currency": "通貨",
  "formDemo.tableView.amount": "金額（dynamic）",
  "formDemo.tableView.note":
    "「拠点」は suggestions のラベルで表示し、選択肢に無い値はそのまま出します。「状態」「担当」の選択肢に無い値は「（不正な値）」と出します。「金額」は行の通貨で表示が変わります。見出しを押すと並べ替え、押すたびに昇順・降順が切り替わります（「金額」は並べ替えません）。",
} satisfies MessagesOf<typeof en>;
