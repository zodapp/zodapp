import { z } from "zod";
import {
  collectionConfig,
  createCollectionMutations,
  createCollectionQueries,
} from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import { memberQueries, membersReference } from "./member";

// タスクステータス（カンバン対応）
export const taskStatusLiterals = [
  z
    .literal("todo")
    .register(zf.literal.registry, { label: "未着手", color: "gray" }),
  z
    .literal("doing")
    .register(zf.literal.registry, { label: "進行中", color: "blue" }),
  z
    .literal("done")
    .register(zf.literal.registry, { label: "完了", color: "green" }),
] as const;

export const taskPriorityLiterals = [
  z
    .literal("low")
    .register(zf.literal.registry, { label: "低", color: "gray" }),
  z
    .literal("medium")
    .register(zf.literal.registry, { label: "中", color: "blue" }),
  z
    .literal("high")
    .register(zf.literal.registry, { label: "高", color: "orange" }),
  z
    .literal("urgent")
    .register(zf.literal.registry, { label: "緊急", color: "red" }),
] as const;

export const taskStatusSchema = zf
  .enum(taskStatusLiterals)
  .register(zf.enum.registry, {
    label: "ステータス",
    uiType: "badge",
    width: 80,
  });

export type TaskStatus = z.infer<typeof taskStatusSchema>;

// 優先度
export const taskPrioritySchema = zf
  .enum(taskPriorityLiterals)
  .register(zf.enum.registry, { label: "優先度", uiType: "badge", width: 80 });

export type TaskPriority = z.infer<typeof taskPrioritySchema>;

const taskDataSchema = z
  .object({
    // 基本情報
    title: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "タスク名", width: 150 }),
    description: zf
      .string()
      .register(zf.string.registry, {
        label: "説明",
        uiType: "textarea",
        width: 150,
      })
      .optional(),

    // 状態管理
    status: taskStatusSchema.default("todo"),
    priority: taskPrioritySchema.default("medium"),

    // ラベル（タグ）
    labels: zf
      .array(zf.string().register(zf.string.registry, { label: "ラベル" }))
      .register(zf.array.registry, {
        label: "ラベル",
        uiType: "multipleString",
      })
      .default([]),

    // 担当・期限（membersCollectionを外部キーとして参照）
    assigneeId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "担当者",
        externalKeyConfig: {
          type: "firestore",
          reference: membersReference,
          contextId: "workspace",
          getQuery: () => memberQueries.queries.all(),
        },
        width: 150,
      })
      .optional(),
    // 担当・期限（membersCollectionを外部キーとして参照）
    watchers: zf
      .array(
        zf.string().register(zf.externalKey.registry, {
          externalKeyConfig: () => ({
            type: "firestore",
            reference: membersReference,
            contextId: "workspace",
            getQuery: () => memberQueries.queries.all(),
          }),
          width: 150,
        }),
      )
      .register(zf.array.registry, {
        label: "ウォッチャー",
        uiType: "multipleExternalKey",
        width: 150,
      })
      .optional(),

    dueAt: zf
      .date()
      .register(zf.date.registry, { label: "期限", width: 100 })
      .optional(),

    deletedAt: zf
      .date()
      .register(zf.date.registry, { label: "削除日", width: 100 })
      .nullable()
      // hiddenフラグは一番外側につけないといけない
      .register(zf.common.registry, { hidden: true }),
  })
  .register(zf.object.registry, {});

const taskCreateExcludedSchema = z.object({
  expired: zfReact
    .computed()
    .register(zf.computed.registry, {
      label: "期限切れ",
      width: 80,
      compute: (data) => {
        return (data.dueAt ? data.dueAt < new Date() : null)
          ? { type: "badge", label: "期限切れ", color: "red" }
          : { type: "badge", label: "期限内", color: "green" };
      },
    })
    .optional(),
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
  archivedAt: zf
    .date()
    .register(zf.date.registry, {
      label: "アーカイブ日",
      readOnly: true,
      width: 100,
    })
    .optional(),
});

export const tasksCollection = collectionConfig({
  path: "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId" as const,
  fieldKeys: [] as const,
  schema: taskDataSchema,
  createExcludedSchema: taskCreateExcludedSchema,

  // create時のみ自動設定
  onCreate: () => ({ createdAt: new Date() }),

  // create/update両方で自動設定
  onWrite: () => ({ updatedAt: new Date() }),

  // フォーム初期化時のデフォルト値（accessorでは適用するものじゃないことに注意）
  onInit: () => ({
    deletedAt: null,
    status: "todo" as const,
    priority: "medium" as const,
    labels: [],
  }),
});

export const taskMutations = createCollectionMutations(tasksCollection, {
  // 引数なしの mutationの例
  softDelete: () => ({ deletedAt: new Date() }),
  archive: () => ({ archivedAt: new Date() }),
  restore: () => ({ deletedAt: null }),

  // カスタムパラメータありの mutationの例
  setDueDate: (dueAt: Date) => ({ dueAt }),
  changeStatus: (status: TaskStatus) => ({ status }),
  assignTo: (assigneeId: string, priority?: TaskPriority) => ({
    assigneeId,
    ...(priority && { priority }),
  }),
});

export const taskQueries = createCollectionQueries(tasksCollection, {
  active: () => ({
    where: [{ field: "deletedAt", operator: "==" as const, value: null }],
  }),
  byStatus: (status: TaskStatus) => ({
    where: [{ field: "status", operator: "==" as const, value: status }],
  }),
});
