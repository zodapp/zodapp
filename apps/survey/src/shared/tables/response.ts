import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import "../form";
import { appTable } from "../table";
import { createOps, isAdmin, isMember } from "../context";
import { answerValueSchema } from "../survey/answers";
import { formatAnswerValue } from "../survey/formatAnswerValue";
import { newId, stampCreate, stampWrite, timestamps } from "./common";

/**
 * アンケートの回答。
 *
 * アンケートの下ではなく、ワークスペースの直下に置く。ワークスペース内の全回答を
 * 1 つのクエリで横断でき（`all`）、特定のアンケートへの絞り込みは Index で行う（`bySurvey`）。
 */
export const responseBodySchema = z
  .object({
    surveyId: zf.string().register(zf.externalKey.registry, {
      label: "アンケート",
      externalKeyConfig: {
        type: "dynamodb",
        contextId: "workspace",
        query: "surveys.active",
        params: (context) => ({ workspaceId: context.workspaceId }),
        valueField: "surveyId",
        labelField: "title",
      },
      width: 180,
    }),
    surveyRevision: zf
      .number()
      .register(zf.number.registry, { label: "回答時の版", readOnly: true, width: 90 })
      .optional(),
    respondentId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "回答者",
        externalKeyConfig: {
          type: "dynamodb",
          contextId: "workspace",
          query: "members.list",
          params: (context) => ({ workspaceId: context.workspaceId }),
          valueField: "email",
          labelField: "displayName",
        },
        width: 160,
      })
      .optional(),
    // 回答本体。キーは質問定義（SurveyFieldDef）の id。
    // 表示は derived メタで整形する（テーブルセルでもそのまま使える）
    answers: z
      .record(
        zf.string(),
        answerValueSchema.register(zf.derived.registry, {
          compute: (value: unknown) => formatAnswerValue(value),
        }),
      )
      .register(zf.record.registry, { label: "回答", width: 200 }),
    // 回答日時。回答ページは送る時刻を、テストデータは過去にばらけた時刻を入れる
    // （onCreate の戻り値は入力より優先されるので、入力で渡す）
    submittedAt: zf
      .date()
      .register(zf.date.registry, { label: "回答日時", readOnly: true, width: 140 }),
  })
  .register(zf.object.registry, {});

export const responseSchema = z
  .object({
    workspaceId: z.string(),
    responseId: z.string(),
    ...responseBodySchema.shape,
    ...timestamps.shape,
  })
  .register(zf.object.registry, {});

export type SurveyResponse = z.output<typeof responseSchema>;

export const responses = tableConfig({
  table: appTable,
  entity: "Response",
  item: responseSchema,
  create: responseBodySchema,
  key: { partition: ["workspaceId"], sort: ["responseId"] },
  indexes: {
    // ワークスペース内の全回答（回答日時の新しい順）
    bySubmittedAt: { slot: "GSI1", partition: ["workspaceId"], sort: ["submittedAt"] },
    // アンケートごとの回答
    bySurvey: {
      slot: "GSI2",
      partition: ["workspaceId", "surveyId"],
      sort: ["submittedAt"],
    },
  },
  generateKey: {
    args: z.object({ workspaceId: z.string() }),
    key: (args) => ({ workspaceId: args.workspaceId, responseId: newId() }),
  },
  onCreate: stampCreate,
  onWrite: stampWrite,
});

const workspaceParams = z.object({ workspaceId: z.string() });

export const responseOps = createOps(responses, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  /** ワークスペース内の全回答（新しい順） */
  all: o.query({
    index: "bySubmittedAt",
    params: workspaceParams,
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
    direction: "desc",
  }),
  /** アンケートごとの回答（新しい順） */
  bySurvey: o.query({
    index: "bySurvey",
    params: workspaceParams.extend({ surveyId: z.string() }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId, surveyId: p.surveyId } }),
    direction: "desc",
  }),
  /** 回答はメンバーなら誰でも作れる（zodapp の Firestore のルールと同じ） */
  create: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => isMember(ctx, args.workspaceId),
  }),
  /** 改竄を防ぐため、削除は管理者だけ */
  remove: o.delete({
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
  }),
}));
