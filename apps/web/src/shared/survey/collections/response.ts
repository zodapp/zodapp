import { z } from "zod";
import { collectionConfig, createCollectionQueries } from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

import {
  memberQueries,
  membersReference,
} from "../../taskManager/collections/member";
import { surveyQueries, surveysReference } from "./survey";
import { formatAnswerValue } from "../formatAnswerValue";

// アンケートの回答。
//
// surveys のサブコレクション（/surveys/:surveyId/responses/...）にはせず、
// **surveys と同じ階層の兄弟コレクション**にしている。
// これにより「ワークスペース内の全回答」を 1 クエリで横断検索でき、
// 特定アンケートへの絞り込みは surveyId の named query で行える。
//
// 注意: surveyId を `fieldKeys`（nonPathKeys）にはしない。
// nonPathKeys は documentIdentity の必須キーになり、autoQuery で常に
// `surveyId ==` が付与されるため、横断クエリが型・実行の両面でできなくなる。

const responseDataSchema = z
  .object({
    surveyId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "アンケート",
        externalKeyConfig: {
          type: "firestore",
          reference: surveysReference,
          contextId: "workspace",
          getQuery: () => surveyQueries.queries.active(),
        },
        width: 180,
      }),
    surveyRevision: zf
      .number()
      .register(zf.number.registry, {
        label: "回答時の版",
        readOnly: true,
        width: 90,
      })
      .optional(),
    respondentId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "回答者",
        externalKeyConfig: {
          type: "firestore",
          reference: membersReference,
          contextId: "workspace",
          getQuery: () => memberQueries.queries.all(),
        },
        width: 160,
      })
      .optional(),

    // 回答本体。キーは質問定義（SurveyFieldDef）の id。
    // 値の型は質問の種類ごとに異なるため unknown で受け、
    // 表示は derived メタで整形する（テーブルセルでもそのまま使える）
    answers: z
      .record(
        zf.string(),
        z.unknown().register(zf.derived.registry, {
          compute: (value: unknown) => formatAnswerValue(value),
        }),
      )
      .register(zf.record.registry, { label: "回答", width: 200 }),

    // 回答日時は通常 onCreate が「今」を入れるが、テストデータ投入では
    // 過去にばらけさせたいので入力値として渡せるようにしてある
    // （createExcludedSchema に置くと create の入力に含められない）
    submittedAt: zf
      .date()
      .register(zf.date.registry, {
        label: "回答日時",
        readOnly: true,
        width: 140,
      })
      .optional(),
  })
  .register(zf.object.registry, {});

const responseCreateExcludedSchema = z.object({
  createdAt: zf
    .date()
    .register(zf.date.registry, {
      label: "作成日",
      readOnly: true,
      width: 100,
    })
    .optional(),
  updatedAt: zf
    .date()
    .register(zf.date.registry, {
      label: "更新日",
      readOnly: true,
      width: 100,
    })
    .optional(),
});

export const responsesCollection = collectionConfig({
  path: "/workspaces/:workspaceId/responses/:responseId" as const,
  fieldKeys: [] as const,
  schema: responseDataSchema,
  createExcludedSchema: responseCreateExcludedSchema,

  // submittedAt は指定があればそれを使う（テストデータで回答日時を
  // 過去にばらけさせられるようにするため）。onCreate の戻り値は
  // 入力データを上書きするので、ここで明示的にフォールバックする
  onCreate: (_documentIdentity, inputData) => ({
    createdAt: new Date(),
    submittedAt: inputData?.submittedAt ?? new Date(),
  }),
  onWrite: () => ({ updatedAt: new Date() }),
});

export const responseQueries = createCollectionQueries(responsesCollection, {
  all: () => ({}),
  // アンケート横断の一覧から、特定アンケートだけに絞り込む
  bySurvey: (surveyId: string) => ({
    where: [{ field: "surveyId", operator: "==" as const, value: surveyId }],
  }),
});
