import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/selectAndExternalKey";

/** form-demo の日本語の辞書（selectAndExternalKey） */
export const ja = {
  "formDemo.page.selectAndExternalKey.description":
    "担当者や拠点を一覧から選ぶ。一覧に無い値の扱い、一覧が届くまでの待ち、一覧が届き直したときの扱い、選んだ値の詳細ページへのリンク",
} satisfies MessagesOf<typeof en>;
