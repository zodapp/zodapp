import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import { appTable } from "../table";
import { createOps, isAdmin, isMember } from "../context";
import { newId, stampCreate, stampWrite, timestamps, patchOf } from "./common";

export const projectStatusLiterals = [
  z.literal("active").register(zf.literal.registry, { label: "アクティブ", color: "green" }),
  z.literal("archived").register(zf.literal.registry, {
    label: "アーカイブ済み",
    color: "gray",
  }),
  z.literal("deleted").register(zf.literal.registry, { label: "削除済み", color: "red" }),
] as const;

export const projectStatusSchema = zf
  .enum(projectStatusLiterals)
  .register(zf.enum.registry, { label: "ステータス", uiType: "badge" });

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectBodySchema = z
  .object({
    name: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "プロジェクト名" }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "textarea" })
      .optional(),
    status: projectStatusSchema.default("active"),
    archivedAt: zf
      .date()
      .register(zf.date.registry, { label: "アーカイブ日", readOnly: true })
      .optional(),
  })
  .register(zf.object.registry, {});

export const projectSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  ...projectBodySchema.shape,
  // Index のキーなので、既定値のない Schema にする（既定値は作成のフォームだけ）
  status: projectStatusSchema,
  ...timestamps.shape,
});

export const projects = tableConfig({
  table: appTable,
  entity: "Project",
  item: projectSchema,
  create: projectBodySchema,
  key: { partition: ["workspaceId"], sort: ["projectId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["createdAt"],
    },
  },
  generateKey: {
    args: z.object({ workspaceId: z.string() }),
    key: (args) => ({ workspaceId: args.workspaceId, projectId: newId() }),
  },
  onCreate: stampCreate,
  onWrite: stampWrite,
});

export const projectOps = createOps(projects, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  /** ステータスごとの一覧（新しい順） */
  byStatus: o.query({
    index: "byStatus",
    params: z.object({ workspaceId: z.string(), status: projectStatusSchema }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
    direction: "desc",
  }),
  create: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => isAdmin(ctx, args.workspaceId),
  }),
  update: o.mutation({
    params: patchOf(projectBodySchema),
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
    patch: (p) => p,
  }),
}));
