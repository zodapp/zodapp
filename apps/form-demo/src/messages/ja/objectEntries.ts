import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/objectEntries";

/** form-demo の日本語の辞書（objectEntries） */
export const ja = {
  "formDemo.page.objectEntries.title": "zf.object（項目を足す）",
  "formDemo.page.objectEntries.description":
    "uiType: entries で、使う項目だけを足していく（検索条件の例）。optional の項目は値にあるときだけ行を出し、⊖ でキーごと消す。必須・nullable の項目は常に出る。足しただけで未入力の行は、値ではキーが undefined で、送信した JSON には入らない",
  "formDemo.objectEntries.range.min": "以上",
  "formDemo.objectEntries.range.max": "以下",
  "formDemo.objectEntries.range.order": "以上は以下より小さくしてください",
  "formDemo.objectEntries.sort.newest": "新しい順",
  "formDemo.objectEntries.sort.cheapest": "安い順",
  "formDemo.objectEntries.keyword": "キーワード",
  "formDemo.objectEntries.title": "タイトル",
  "formDemo.objectEntries.author": "著者",
  "formDemo.objectEntries.price": "価格",
  "formDemo.objectEntries.sort": "並べ替え",
  "formDemo.objectEntries.publisher": "出版社",
  "formDemo.objectEntries.condition": "検索条件（keyOrder: definition）",
  "formDemo.objectEntries.conditionByValue": "検索条件（keyOrder: value）",
} satisfies MessagesOf<typeof en>;
