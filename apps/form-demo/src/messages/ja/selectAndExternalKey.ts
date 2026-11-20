import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/selectAndExternalKey";

/** form-demo の日本語の辞書（selectAndExternalKey） */
export const ja = {
  "formDemo.page.selectAndExternalKey.description":
    "担当者や拠点を一覧から選ぶ。一覧に無い値の扱い、一覧が届くまでの待ち、一覧が届き直したときの扱い、選んだ値の詳細ページへのリンク",
  "formDemo.selectAndExternalKey.citySchema.resolve.schema": "市区町村",
  "formDemo.selectAndExternalKey.officeLegacy":
    'string + uiType: "select"（選択肢に無い保存値もそのまま通る）',
  "formDemo.selectAndExternalKey.status.open": "対応中",
  "formDemo.selectAndExternalKey.status.done": "完了",
  "formDemo.selectAndExternalKey.assignee":
    "externalKey（既定：選択肢に無い値は誤り）+ valueAction",
  "formDemo.selectAndExternalKey.assigneeFree":
    "externalKey + allowUnlisted（選択肢に無い値も通す）",
  "formDemo.selectAndExternalKey.slowAssignee":
    "externalKey（取得に 3 秒かかる。読み込み中は選べず、送信も止まる）",
  "formDemo.selectAndExternalKey.onDuty":
    "当番（既定の clear。選んだ人が選択肢から外れると値が消え、戻っても値は戻らない）",
  "formDemo.selectAndExternalKey.onDutyKeep":
    "当番（unlisted: keep。外れると値を残して「（不正な値）」とエラーを出し、戻れば元の表示に戻る）",
  "formDemo.selectAndExternalKey.prefecture": "都道府県",
  "formDemo.selectAndExternalKey.try.heading":
    "当番の選択肢を届け直す（2 つの「当番」の欄が同じ topic を購読している）",
  "formDemo.selectAndExternalKey.try.all": "全員を届け直す",
  "formDemo.selectAndExternalKey.try.without": ({ name }) =>
    `${name}を外して届け直す`,
  "formDemo.selectAndExternalKey.try.rotate":
    "5 秒ごとに一人ずつ外して届け直す",
} satisfies MessagesOf<typeof en>;
