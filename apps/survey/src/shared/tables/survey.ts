import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import { appTable } from "../table";
import { canEditSurvey, createOps, isAdmin, isMember } from "../context";
import { surveyFieldsSchema } from "../survey/fieldDefs";
import { newId, patchOf, stampCreate, stampWrite, timestamps } from "./common";

export const surveyStatusLiterals = [
  z.literal("draft").register(zf.literal.registry, { label: "下書き", color: "gray" }),
  z.literal("published").register(zf.literal.registry, { label: "公開中", color: "green" }),
  z.literal("closed").register(zf.literal.registry, { label: "終了", color: "orange" }),
] as const;

export const surveyStatusSchema = zf
  .enum(surveyStatusLiterals)
  .register(zf.enum.registry, { label: "状態", uiType: "badge", width: 90 });

export type SurveyStatus = z.infer<typeof surveyStatusSchema>;

/** フォームで編集する本体（質問の定義を含む） */
export const surveyBodySchema = z
  .object({
    title: zf
      .string()
      .min(1, "アンケート名を入力してください")
      .register(zf.string.registry, { label: "アンケート名", width: 200 }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "multiline", width: 200 })
      .optional(),
    fields: surveyFieldsSchema,
  })
  .register(zf.object.registry, {});

export const surveySchema = z
  .object({
    workspaceId: z.string(),
    surveyId: z.string(),
    ...surveyBodySchema.shape,
    status: surveyStatusSchema,
    /** 公開のたびに 1 ずつ増える版。回答は回答時の版を記録する */
    revision: zf
      .number()
      .register(zf.number.registry, { label: "公開版", readOnly: true, width: 70 }),
    publishedAt: zf
      .date()
      .register(zf.date.registry, { label: "公開日時", readOnly: true, width: 130 })
      .optional(),
    /** 論理削除。null なら有効（Index に null として載り、有効な一覧で引ける） */
    deletedAt: zf
      .date()
      .register(zf.date.registry, { label: "削除日", width: 100 })
      .nullable()
      // hiddenフラグは一番外側につけないといけない
      .register(zf.common.registry, { hidden: true }),
    ...timestamps.shape,
  })
  .register(zf.object.registry, {});

export type Survey = z.output<typeof surveySchema>;

export const surveys = tableConfig({
  table: appTable,
  entity: "Survey",
  item: surveySchema,
  create: surveyBodySchema,
  key: { partition: ["workspaceId"], sort: ["surveyId"] },
  indexes: {
    // 有効なアンケート（deletedAt が null）とゴミ箱を、Sort Key の先頭で分ける
    byDeletedAt: {
      slot: "GSI1",
      partition: ["workspaceId"],
      sort: ["deletedAt", "createdAt"],
    },
  },
  generateKey: {
    args: z.object({ workspaceId: z.string() }),
    key: (args) => ({ workspaceId: args.workspaceId, surveyId: newId() }),
  },
  onCreate: (ctx) => ({
    ...stampCreate(ctx),
    status: "draft" as const,
    revision: 0,
    deletedAt: null,
  }),
  onWrite: stampWrite,
});

const workspaceParams = z.object({ workspaceId: z.string() });
const noParams = z.object({});

export const surveyOps = createOps(surveys, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  /** 有効なアンケート（新しい順） */
  active: o.query({
    index: "byDeletedAt",
    params: workspaceParams,
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId }, sort: { deletedAt: null } }),
    direction: "desc",
  }),
  /** ゴミ箱（削除の新しい順） */
  deleted: o.query({
    index: "byDeletedAt",
    params: workspaceParams,
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId },
      sort: { deletedAt: { gte: new Date(0) } },
    }),
    direction: "desc",
  }),
  create: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => canEditSurvey(ctx, args.workspaceId),
  }),
  /** テストデータ：ID を固定した定義を、何度入れても同じ内容に置き換える */
  put: o.set({
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
  }),
  /** 下書きの保存（タイトル・説明・質問の定義） */
  update: o.mutation({
    params: patchOf(surveyBodySchema),
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: (p) => p,
  }),
  /** 公開。版を 1 つ上げる（読まずに原子的に加算する） */
  publish: o.mutation({
    params: noParams,
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: () => ({ status: "published" as const, publishedAt: new Date() }),
    add: () => ({ revision: 1 }),
  }),
  /** 受付の終了（公開中のものだけ） */
  close: o.mutation({
    params: noParams,
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: () => ({ status: "closed" as const }),
    where: () => ({ status: "published" }),
  }),
  /** 受付の再開（終了したものだけ） */
  reopen: o.mutation({
    params: noParams,
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: () => ({ status: "published" as const }),
    where: () => ({ status: "closed" }),
  }),
  softDelete: o.mutation({
    params: noParams,
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: () => ({ deletedAt: new Date() }),
  }),
  restore: o.mutation({
    params: noParams,
    authorize: (ctx, { key }) => canEditSurvey(ctx, key.workspaceId),
    patch: () => ({ deletedAt: null }),
  }),
  /** 完全に消す（テストデータの入れ直し） */
  remove: o.delete({
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
  }),
}));
