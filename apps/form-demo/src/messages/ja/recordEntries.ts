import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/recordEntries";

/** form-demo の日本語の辞書（recordEntries） */
export const ja = {
  "formDemo.page.recordEntries.description":
    "キーと値の組を、追加・削除・編集する。キーが enum・literal で決まっている record はキーごとの固定の欄、Map は組を足して編集する欄になる。キーが enum の partialRecord は、既定では候補のキーを全部並べて各欄を optional にし（空にするとキーごと消す）、uiType: entries では値にあるキーだけを並べて、いちばん下の選択でキーを足す（行は削除だけできる。並びは keyOrder で、definition は定義順、value は値の順）",
  "formDemo.recordEntries.envKeySchema.min": "キーを入力してください",
  "formDemo.recordEntries.envKeySchema.regex":
    "大文字英数字とアンダースコアのみ使用できます",
  "formDemo.recordEntries.envVars": "環境変数（uiType: entries）",
  "formDemo.recordEntries.labels":
    "数値の Record（値の型も任意のスキーマにできる）",
  "formDemo.recordEntries.greeting.key.ja": "日本語",
  "formDemo.recordEntries.greeting.key.en": "英語",
  "formDemo.recordEntries.greeting.key.zh": "中国語",
  "formDemo.recordEntries.greeting": "挨拶（キーが enum）",
  "formDemo.recordEntries.stock": "サイズ別の在庫（キーが複数の値の literal）",
  "formDemo.recordEntries.nicknames.key.alice": "アリス",
  "formDemo.recordEntries.nicknames.key.bob": "ボブ",
  "formDemo.recordEntries.nicknames.key.carol": "キャロル",
  "formDemo.recordEntries.nicknames": "あだ名（キーが enum の partialRecord）",
  "formDemo.recordEntries.branches":
    "支店の数（partialRecord・uiType: entries）",
  "formDemo.recordEntries.branchesByValue": "支店の数（keyOrder: value）",
  "formDemo.recordEntries.quota": "上限（Map<string, number>）",
} satisfies MessagesOf<typeof en>;
