import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/objectLayout";

/** form-demo の日本語の辞書（objectLayout） */
export const ja = {
  "formDemo.page.objectLayout.title": "zf.object（並べ方）",
  "formDemo.page.objectLayout.description":
    "項目を横に並べる、枠で囲む、表示順を変える",
  "formDemo.objectLayout.nameFields.lastName": "姓",
  "formDemo.objectLayout.nameFields.firstName": "名",
  "formDemo.objectLayout.nameFields.lastNameKana": "セイ",
  "formDemo.objectLayout.nameFields.firstNameKana": "メイ",
  "formDemo.objectLayout.horizontal": "横並び（uiType: horizontal）",
  "formDemo.objectLayout.horizontalWrap":
    "横並び折返し（uiType: horizontal-wrap）",
  "formDemo.objectLayout.boxed": "枠囲み（uiType: box）",
  "formDemo.objectLayout.reordered": "表示順制御（properties: カナ→漢字の順）",
  "formDemo.objectLayout.horizontalErrors":
    "横並びのエラー（送信するとエラーが出る）",
  "formDemo.objectLayout.horizontalErrors.keyword": "キーワード",
  "formDemo.objectLayout.horizontalErrors.period.from": "開始",
  "formDemo.objectLayout.horizontalErrors.period.to": "終了",
  "formDemo.objectLayout.horizontalErrors.filter": "絞り込み",
  "formDemo.objectLayout.horizontalErrors.filter.activeOnly": "有効のみ",
} satisfies MessagesOf<typeof en>;
