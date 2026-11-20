import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/recordEntries";

/** form-demo の日本語の辞書（recordEntries） */
export const ja = {
  "formDemo.page.recordEntries.description":
    "キーと値の組を、追加・削除・編集する。キーが enum・literal で決まっている record はキーごとの固定の欄、Map は組を足して編集する欄になる。キーが enum の partialRecord は、既定では候補のキーを全部並べて各欄を optional にし（空にするとキーごと消す）、uiType: entries では値にあるキーだけを並べて、いちばん下の選択でキーを足す（行は削除だけできる。並びは keyOrder で、definition は定義順、value は値の順）",
} satisfies MessagesOf<typeof en>;
