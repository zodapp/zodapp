import { z } from "zod";
import { collectionConfig, createCollectionQueries } from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

export const projectStatusLiterals = [
  z
    .literal("active")
    .register(zf.literal.registry, { label: "アクティブ", color: "green" }),
  z.literal("archived").register(zf.literal.registry, {
    label: "アーカイブ済み",
    color: "gray",
  }),
  z
    .literal("deleted")
    .register(zf.literal.registry, { label: "削除済み", color: "red" }),
] as const;

// プロジェクトステータスのリテラル定義
export const projectStatusSchema = zf
  .enum(projectStatusLiterals)
  .register(zf.enum.registry, { label: "ステータス", uiType: "badge" });

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const projectDataSchema = z
  .object({
    // 基本情報
    name: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "プロジェクト名" }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "textarea" })
      .optional(),

    // 状態
    status: projectStatusSchema.default("active"),

    archivedAt: zf
      .date()
      .register(zf.date.registry, { label: "アーカイブ日", readOnly: true })
      .optional(),
  })
  .register(zf.object.registry, {});

const projectCreateExcludedSchema = z.object({
  createdAt: zf
    .date()
    .register(zf.date.registry, { label: "作成日", readOnly: true })
    .optional(),
  updatedAt: zf
    .date()
    .register(zf.date.registry, { label: "更新日", readOnly: true })
    .optional(),
});

export const projectsCollection = collectionConfig({
  path: "/workspaces/:workspaceId/projects/:projectId" as const,
  fieldKeys: [] as const,
  schema: projectDataSchema,
  createExcludedSchema: projectCreateExcludedSchema,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
  onInit: () => ({ status: "active" as const }),
});

export const projectQueries = createCollectionQueries(projectsCollection, {
  active: () => ({
    where: [
      { field: "status", operator: "==" as const, value: "active" as const },
    ],
  }),
  byStatus: (status: ProjectStatus) => ({
    where: [{ field: "status", operator: "==" as const, value: status }],
  }),
});
