import type { z } from "zod";

import { surveysCollection } from "../../shared/survey/collections";
import { generateFieldId } from "../../shared/survey/fieldDefs";

type SurveyCreateInput = z.infer<typeof surveysCollection.createSchema>;

/**
 * デモ用のサンプルアンケート。
 * DSL（質問定義）がどういう JSON で保存されるのかを実物で示す。
 */
const buildSampleSurveys = (): SurveyCreateInput[] => [
  {
    title: "サービス満足度アンケート",
    description: "ご利用ありがとうございます。今後の改善のためご協力ください。",
    status: "published",
    deletedAt: null,
    fields: [
      {
        type: "text",
        id: generateFieldId(),
        label: "お名前",
        required: true,
        maxLength: 40,
      },
      {
        type: "select",
        id: generateFieldId(),
        label: "総合満足度",
        required: true,
        options: [
          { value: generateFieldId(), label: "とても満足" },
          { value: generateFieldId(), label: "満足" },
          { value: generateFieldId(), label: "ふつう" },
          { value: generateFieldId(), label: "不満" },
        ],
      },
      {
        type: "number",
        id: generateFieldId(),
        label: "1か月の利用回数",
        min: 0,
        max: 100,
      },
      {
        type: "multiline",
        id: generateFieldId(),
        label: "ご意見・ご要望",
      },
      {
        type: "date",
        id: generateFieldId(),
        label: "最終利用日",
      },
      {
        type: "boolean",
        id: generateFieldId(),
        label: "調査結果の利用に同意する",
        required: true,
      },
    ],
  },
  {
    title: "社内イベント参加登録（下書き）",
    description: "公開前の下書きです。ビルダーで編集してから公開してください。",
    status: "draft",
    deletedAt: null,
    fields: [
      {
        type: "text",
        id: generateFieldId(),
        label: "所属部署",
        required: true,
      },
      {
        type: "select",
        id: generateFieldId(),
        label: "参加希望日",
        options: [
          { value: generateFieldId(), label: "初日" },
          { value: generateFieldId(), label: "2日目" },
        ],
      },
    ],
  },
];

export const populateSurveySeed = async (
  create: (data: SurveyCreateInput) => Promise<void>,
): Promise<void> => {
  for (const survey of buildSampleSurveys()) {
    await create(survey);
  }
};
