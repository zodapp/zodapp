import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/externalKeyFilter";

/** form-demo の日本語の辞書（externalKeyFilter） */
export const ja = {
  "formDemo.page.externalKeyFilter.title": "zf.externalKey（絞り込み）",
  "formDemo.page.externalKeyFilter.description":
    "ログイン中の部署などで一覧を絞る。条件を切り替えたときに一覧を取り直す。外れた値は消える（clear）か、残して「（不正な値）」とエラーを出す（keep）。複数選択の欄も同じ。「動きを試す」で、取得の時機を選ぶ・失敗させる・同じ購読のまま選択肢を 0 件にして戻す・無い topic の欄を出す",
  "formDemo.externalKeyFilter.assignee":
    "担当者（画面上部で選んだ部署で絞る。context の filter）",
  "formDemo.externalKeyFilter.assigneeKeep":
    "担当者（unlisted: keep。外れた値を残し、不正な値として出す）",
  "formDemo.externalKeyFilter.watcherKey": "見守る人",
  "formDemo.externalKeyFilter.watchers":
    "見守る人（複数選択。画面上部で選んだ部署で絞る）",
  "formDemo.externalKeyFilter.watchersKeep":
    "見守る人（複数選択。unlisted: keep）",
  "formDemo.externalKeyFilter.reviewer.resolve.schema":
    "レビュー担当（レビューする部署で絞る）",
  "formDemo.externalKeyFilter.reviewTeam.sales": "営業",
  "formDemo.externalKeyFilter.reviewTeam.dev": "開発",
  "formDemo.externalKeyFilter.reviewTeam": "レビューする部署",
  "formDemo.externalKeyFilter.missing": "無い topic の欄",
  "formDemo.externalKeyFilter.try.team":
    "画面の部署（resolverContext の team）",
  "formDemo.externalKeyFilter.try.team.sales": "営業",
  "formDemo.externalKeyFilter.try.team.dev": "開発",
  "formDemo.externalKeyFilter.try.description":
    "選択肢が届く時機を選んだり、わざと失敗させたりできる。ふだんは「見やすい遅延」（0.4 秒）のまま使う。「選択肢を 0 件にする」「選択肢を戻す」は、購読を張り直さずに担当者・見守る人の選択肢を届け直す",
  "formDemo.externalKeyFilter.try.empty": "選択肢を 0 件にする",
  "formDemo.externalKeyFilter.try.restore": "選択肢を戻す",
  "formDemo.externalKeyFilter.try.missing":
    "無い topic の欄を出す（出すと取得に失敗し、送信が止まる）",
} satisfies MessagesOf<typeof en>;
