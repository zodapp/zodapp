import type { z } from "zod";

import { surveysCollection } from "./collections/survey";
import type { SurveyFieldDef } from "./fieldDefs";

/**
 * アンケートの構造データ（テストデータの「冪等」な部分）。
 *
 * - **ドキュメント ID と質問 ID を固定**しているので、再投入は上書きになり重複しない
 * - `createdAt` も固定値にして、投入のたびに内容が変わらないようにしている
 * - ワークスペース ID は引数で受けるため、**CI（固定ワークスペース）と
 *   アプリ（ログインユーザーのワークスペース）の両方から同じ定義を使える**
 *
 * 回答（responses）はここに含めない。回答は「繰り返し投入して
 * GrowingList などのリアクティブ動作を確認する」ためのデータなので、
 * 非冪等な生成（generateDummyAnswers）側で扱う。
 */

const FIXTURE_CREATED_AT = new Date("2026-01-15T00:00:00.000Z");
const FIXTURE_PUBLISHED_AT = new Date("2026-01-16T00:00:00.000Z");
const FIXTURE_DELETED_AT = new Date("2026-02-01T00:00:00.000Z");

export type SurveyFixture = {
  surveyId: string;
  /** 一覧に出すための説明（テストデータ画面で表示する） */
  summary: string;
  fields: SurveyFieldDef[];
  data: Omit<z.infer<typeof surveysCollection.dataSchema>, "workspaceId" | "surveyId">;
};

const satisfactionFields: SurveyFieldDef[] = [
  {
    type: "text",
    id: "q_name",
    label: "お名前",
    required: true,
    maxLength: 40,
  },
  {
    type: "select",
    id: "q_satisfaction",
    label: "総合満足度",
    required: true,
    options: [
      { value: "opt_excellent", label: "とても満足" },
      { value: "opt_good", label: "満足" },
      { value: "opt_normal", label: "ふつう" },
      { value: "opt_bad", label: "不満" },
    ],
  },
  {
    type: "number",
    id: "q_visits",
    label: "1か月の利用回数",
    min: 0,
    max: 100,
  },
  {
    type: "multiline",
    id: "q_comment",
    label: "ご意見・ご要望",
  },
  {
    type: "date",
    id: "q_last_visit",
    label: "最終利用日",
  },
  {
    type: "boolean",
    id: "q_consent",
    label: "調査結果の利用に同意する",
    required: true,
  },
];

const eventFields: SurveyFieldDef[] = [
  {
    type: "text",
    id: "q_department",
    label: "所属部署",
    required: true,
  },
  {
    type: "select",
    id: "q_day",
    label: "参加希望日",
    options: [
      { value: "opt_day1", label: "初日" },
      { value: "opt_day2", label: "2日目" },
    ],
  },
];

const archivedFields: SurveyFieldDef[] = [
  {
    type: "multiline",
    id: "q_feedback",
    label: "昨年度の振り返り",
  },
];

export const surveyFixtures: SurveyFixture[] = [
  {
    surveyId: "fx-satisfaction",
    summary: "公開中・全6種類の質問を含む",
    fields: satisfactionFields,
    data: {
      title: "サービス満足度アンケート",
      description:
        "ご利用ありがとうございます。今後の改善のためご協力ください。",
      status: "published",
      revision: 1,
      publishedAt: FIXTURE_PUBLISHED_AT,
      fields: satisfactionFields,
      deletedAt: null,
      createdAt: FIXTURE_CREATED_AT,
      updatedAt: FIXTURE_PUBLISHED_AT,
    },
  },
  {
    surveyId: "fx-event",
    summary: "下書き・ビルダーで編集して公開する用",
    fields: eventFields,
    data: {
      title: "社内イベント参加登録",
      description: "公開前の下書きです。ビルダーで編集してから公開してください。",
      status: "draft",
      revision: 0,
      fields: eventFields,
      deletedAt: null,
      createdAt: FIXTURE_CREATED_AT,
      updatedAt: FIXTURE_CREATED_AT,
    },
  },
  {
    surveyId: "fx-archived",
    summary: "論理削除済み・ゴミ箱と復元の確認用",
    fields: archivedFields,
    data: {
      title: "（終了）昨年度サービス評価",
      description: "ゴミ箱表示と復元の確認用データです。",
      status: "closed",
      revision: 1,
      publishedAt: FIXTURE_PUBLISHED_AT,
      fields: archivedFields,
      deletedAt: FIXTURE_DELETED_AT,
      createdAt: FIXTURE_CREATED_AT,
      updatedAt: FIXTURE_DELETED_AT,
    },
  },
];

/** 回答のダミーデータを作る対象（公開中のもの） */
export const publishedSurveyFixture = surveyFixtures[0]!;

/** 投入先のドキュメントパス（テストデータ画面での表示・CI での書き込みに使う） */
export const buildSurveyFixturePath = (
  workspaceId: string,
  surveyId: string,
): string =>
  surveysCollection.buildDocumentPath({ workspaceId, surveyId });
