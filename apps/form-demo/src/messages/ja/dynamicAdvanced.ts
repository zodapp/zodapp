import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/dynamicAdvanced";

/** form-demo の日本語の辞書（dynamicAdvanced） */
export const ja = {
  "formDemo.page.dynamicAdvanced.title": "zf.dynamic（読み込み・購読・連動）",
  "formDemo.page.dynamicAdvanced.description":
    "スキーマをサーバーから読み込む（読み込み中・失敗・再試行）、変わり続ける上限、住所の連動（米国：州→市→地区、日本：都道府県→市区町村→町名）。帳票の種類を変えると、帳票の項目だけを取り直す。取得を失敗させると「再試行」が出て送信が止まる。住所の上の欄を変えると、下の欄が順に消える。「動きを試す」で取得の時機を選び、止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める",
  "formDemo.dynamicAdvanced.templateFields.invoice.dueDate": "支払期限",
  "formDemo.dynamicAdvanced.templateFields.invoice.amount": "請求額",
  "formDemo.dynamicAdvanced.templateFields.invoice": "請求書の項目",
  "formDemo.dynamicAdvanced.templateFields.receipt.payer": "宛名",
  "formDemo.dynamicAdvanced.templateFields.receipt.note": "但し書き",
  "formDemo.dynamicAdvanced.templateFields.receipt.reissued": "再発行",
  "formDemo.dynamicAdvanced.templateFields.receipt": "領収書の項目",
  "formDemo.dynamicAdvanced.template.invoice": "請求書",
  "formDemo.dynamicAdvanced.template.receipt": "領収書",
  "formDemo.dynamicAdvanced.template": "帳票の種類",
  "formDemo.dynamicAdvanced.quantity.max": ({ stock }) =>
    `在庫（${stock}）を超えています`,
  "formDemo.dynamicAdvanced.quantity": ({ stock }) => `数量（在庫 ${stock}）`,
  "formDemo.dynamicAdvanced.harness.toggle":
    "外から書き込む（帳票の種類を切り替える）",
  "formDemo.dynamicAdvanced.harness.toggleAsUser":
    "利用者の編集として書き込む（帳票の種類を切り替える）",
  "formDemo.dynamicAdvanced.try.description":
    "取得が届く時機を選ぶ・わざと失敗させる・在庫を変える。ふだんは「見やすい遅延」（帳票の項目は 1 秒、選択肢は 0.4 秒）のまま使う。止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める",
  "formDemo.dynamicAdvanced.try.rotate": "在庫を 3 秒ごとに変える",
  "formDemo.dynamicAdvanced.try.stock3": "在庫を 3 にする",
  "formDemo.dynamicAdvanced.try.stock10": "在庫を 10 にする",
  "formDemo.dynamicAdvanced.addressUs": "住所（米国）",
  "formDemo.dynamicAdvanced.addressUs.state": "州",
  "formDemo.dynamicAdvanced.addressUs.city": "市",
  "formDemo.dynamicAdvanced.addressUs.city.emptyMessage":
    "先に州を選んでください",
  "formDemo.dynamicAdvanced.addressUs.neighborhood": "地区",
  "formDemo.dynamicAdvanced.addressUs.neighborhood.emptyMessage":
    "先に市を選んでください",
  "formDemo.dynamicAdvanced.addressJp":
    "住所（日本。選択肢はデータなので、言語を切り替えても日本語のまま）",
  "formDemo.dynamicAdvanced.addressJp.prefecture": "都道府県",
  "formDemo.dynamicAdvanced.addressJp.city": "市区町村",
  "formDemo.dynamicAdvanced.addressJp.city.emptyMessage":
    "先に都道府県を選んでください",
  "formDemo.dynamicAdvanced.addressJp.town": "町名",
  "formDemo.dynamicAdvanced.addressJp.town.emptyMessage":
    "先に市区町村を選んでください",
} satisfies MessagesOf<typeof en>;
