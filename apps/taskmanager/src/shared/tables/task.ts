import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import "../form";
import { appTable } from "../table";
import { canWriteTask, createOps, isMember } from "../context";
import { newId, stampCreate, stampWrite, timestamps, patchOf } from "./common";
import { assignableRoles } from "./member";

// タスクステータス（カンバン対応）
export const taskStatusLiterals = [
  z.literal("todo").register(zf.literal.registry, { label: "未着手", color: "gray" }),
  z.literal("doing").register(zf.literal.registry, { label: "進行中", color: "blue" }),
  z.literal("done").register(zf.literal.registry, { label: "完了", color: "green" }),
] as const;

export const taskPriorityLiterals = [
  z.literal("low").register(zf.literal.registry, { label: "低", color: "gray" }),
  z.literal("medium").register(zf.literal.registry, { label: "中", color: "blue" }),
  z.literal("high").register(zf.literal.registry, { label: "高", color: "orange" }),
  z.literal("urgent").register(zf.literal.registry, { label: "緊急", color: "red" }),
] as const;

export const taskStatusSchema = zf
  .enum(taskStatusLiterals)
  .register(zf.enum.registry, { label: "ステータス", uiType: "badge", width: 80 });

export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = zf
  .enum(taskPriorityLiterals)
  .register(zf.enum.registry, { label: "優先度", uiType: "badge", width: 80 });

export type TaskPriority = z.infer<typeof taskPrioritySchema>;

/** 担当者の選択肢：同じワークスペースの、担当できるロールのメンバー */
const assigneeKey = () =>
  zf.string().register(zf.externalKey.registry, {
    label: "担当者",
    externalKeyConfig: {
      type: "dynamodb",
      contextId: "workspace",
      query: "members.list",
      params: (context) => ({ workspaceId: context.workspaceId }),
      valueField: "email",
      labelField: "displayName",
      filter: (item) => assignableRoles.includes(item.role as never),
    },
    width: 150,
  });

/** フォームで編集する本体 */
export const taskBodySchema = z
  .object({
    title: zf.string().min(1).register(zf.string.registry, { label: "タスク名", width: 150 }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "textarea", width: 150 })
      .optional(),
    status: taskStatusSchema.default("todo"),
    priority: taskPrioritySchema.default("medium"),
    labels: zf
      .array(zf.string().register(zf.string.registry, { label: "ラベル" }))
      .register(zf.array.registry, { label: "ラベル", uiType: "multipleString" })
      .default([]),
    assigneeId: assigneeKey().optional(),
    watchers: zf
      .array(
        zf.string().register(zf.externalKey.registry, {
          externalKeyConfig: {
            type: "dynamodb",
            contextId: "workspace",
            query: "members.list",
            params: (context) => ({ workspaceId: context.workspaceId }),
            valueField: "email",
            labelField: "displayName",
          },
          width: 150,
        }),
      )
      .register(zf.array.registry, {
        label: "ウォッチャー",
        uiType: "multipleExternalKey",
        width: 150,
      })
      .optional(),
    dueAt: zf.date().register(zf.date.registry, { label: "期限", width: 100 }).optional(),
  })
  .register(zf.object.registry, {});

export const taskSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  ...taskBodySchema.shape,
  // Index のキーには .default() を使えないので、Item では既定値なしにする
  status: taskStatusSchema,
  /** 論理削除。null なら有効（Index に null として載り、有効な一覧で引ける） */
  deletedAt: zf
    .date()
    .register(zf.date.registry, { label: "削除日", width: 100 })
    .nullable()
    // hiddenフラグは一番外側につけないといけない
    .register(zf.common.registry, { hidden: true }),
  archivedAt: zf
    .date()
    .register(zf.date.registry, { label: "アーカイブ日", readOnly: true, width: 100 })
    .optional(),
  ...timestamps.shape,
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskSchema,
  create: taskBodySchema,
  key: { partition: ["workspaceId", "projectId"], sort: ["taskId"] },
  indexes: {
    // 有効なタスク（deletedAt が null）とゴミ箱を、Sort Key の先頭で分ける
    byDeletedAt: {
      slot: "GSI2",
      partition: ["workspaceId", "projectId"],
      sort: ["deletedAt", "createdAt"],
    },
    // ステータスで絞った有効なタスク。DynamoDB はキーでしか絞り込めないので、
    // 画面の検索条件のうちステータスはこの Index で、残りはブラウザで絞る
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "projectId", "status"],
      sort: ["deletedAt", "createdAt"],
    },
  },
  generateKey: {
    args: z.object({ workspaceId: z.string(), projectId: z.string() }),
    key: (args) => ({ ...args, taskId: newId() }),
  },
  onCreate: (ctx) => ({ ...stampCreate(ctx), deletedAt: null }),
  onWrite: stampWrite,
});

const projectParams = z.object({ workspaceId: z.string(), projectId: z.string() });

export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  /** 有効なタスク（新しい順） */
  active: o.query({
    index: "byDeletedAt",
    params: projectParams,
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, projectId: p.projectId },
      sort: { deletedAt: null },
    }),
    direction: "desc",
  }),
  /** 有効なタスクのうち、ステータスが一致するもの（新しい順） */
  activeByStatus: o.query({
    index: "byStatus",
    params: projectParams.extend({ status: taskStatusSchema }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, projectId: p.projectId, status: p.status },
      sort: { deletedAt: null },
    }),
    direction: "desc",
  }),
  /** ゴミ箱（削除の新しい順） */
  deleted: o.query({
    index: "byDeletedAt",
    params: projectParams,
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, projectId: p.projectId },
      sort: { deletedAt: { gte: new Date(0) } },
    }),
    direction: "desc",
  }),
  create: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => canWriteTask(ctx, args.workspaceId),
  }),
  update: o.mutation({
    params: patchOf(taskBodySchema),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: (p) => p,
  }),
  // 名前付きミューテーション（zodapp の taskMutations と同じもの）
  softDelete: o.mutation({
    params: z.object({}),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: () => ({ deletedAt: new Date() }),
  }),
  restore: o.mutation({
    params: z.object({}),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: () => ({ deletedAt: null }),
  }),
  archive: o.mutation({
    params: z.object({}),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: () => ({ archivedAt: new Date() }),
  }),
  setDueDate: o.mutation({
    params: z.object({ dueAt: z.date() }),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: (p) => ({ dueAt: p.dueAt }),
  }),
  changeStatus: o.mutation({
    params: z.object({ status: taskStatusSchema }),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
  }),
  assignTo: o.mutation({
    params: z.object({ assigneeId: z.string(), priority: taskPrioritySchema.optional() }),
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
    patch: (p) => ({
      assigneeId: p.assigneeId,
      ...(p.priority && { priority: p.priority }),
    }),
  }),
  remove: o.delete({
    authorize: (ctx, { key }) => canWriteTask(ctx, key.workspaceId),
  }),
}));
