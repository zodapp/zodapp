import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/externalKeyFilter";

/** form-demo の日本語の辞書（externalKeyFilter） */
export const ja = {
  "formDemo.page.externalKeyFilter.title": "zf.externalKey（絞り込み）",
  "formDemo.page.externalKeyFilter.description":
    "ログイン中の部署などで一覧を絞る。条件を切り替えたときに一覧を取り直す。外れた値は消える（clear）か、残して「（不正な値）」とエラーを出す（keep）。複数選択の欄も同じ。「動きを試す」で、取得の時機を選ぶ・失敗させる・同じ購読のまま選択肢を 0 件にして戻す・無い topic の欄を出す",
} satisfies MessagesOf<typeof en>;
