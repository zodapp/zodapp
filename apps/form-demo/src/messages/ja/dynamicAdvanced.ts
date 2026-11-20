import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/dynamicAdvanced";

/** form-demo の日本語の辞書（dynamicAdvanced） */
export const ja = {
  "formDemo.page.dynamicAdvanced.title": "zf.dynamic（読み込み・購読・連動）",
  "formDemo.page.dynamicAdvanced.description":
    "スキーマをサーバーから読み込む（読み込み中・失敗・再試行）、変わり続ける上限、都道府県→市区町村→町名の連動。帳票の種類を変えると、帳票の項目だけを取り直す。取得を失敗させると「再試行」が出て送信が止まる。都道府県を変えると、市区町村・町名が順に消える。「動きを試す」で取得の時機を選び、止めておく分け方では「届ける」「失敗させる」で 1 回ずつ進める",
} satisfies MessagesOf<typeof en>;
