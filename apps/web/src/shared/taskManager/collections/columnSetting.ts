import { z } from "zod";
import {
  collectionConfig,
  createCollectionQueries,
} from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

// テーブル列設定プロファイルの保存用コレクション。
// AutoTable の ColumnEntry（{ id, fieldPath?, width }）をそのまま保存する。
// - ユーザー個人用: /users/:userId/columnSettings/:settingId
// - ワークスペース共通: /workspaces/:workspaceId/columnSettings/:settingId

const columnEntrySchema = z.object({
  id: zf.string().register(zf.string.registry, {}),
  fieldPath: zf.string().register(zf.string.registry, {}).optional(),
  width: zf.string().register(zf.string.registry, {}),
});

const columnSettingDataSchema = z
  .object({
    // どのテーブルの設定か（例: "task" / "project"）
    tableKey: zf.string().min(1).register(zf.string.registry, {
      label: "テーブルキー",
    }),
    name: zf.string().min(1).register(zf.string.registry, { label: "設定名" }),
    columns: zf
      .array(columnEntrySchema)
      .register(zf.array.registry, { label: "列構成" })
      .nullable(),
  })
  .register(zf.object.registry, {});

const columnSettingCreateExcludedSchema = z.object({
  createdAt: zf
    .date()
    .register(zf.date.registry, { label: "作成日", readOnly: true })
    .optional(),
  updatedAt: zf
    .date()
    .register(zf.date.registry, { label: "更新日", readOnly: true })
    .optional(),
});

export const userColumnSettingsCollection = collectionConfig({
  path: "/users/:userId/columnSettings/:settingId" as const,
  fieldKeys: [] as const,
  schema: columnSettingDataSchema,
  createExcludedSchema: columnSettingCreateExcludedSchema,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});

export const workspaceColumnSettingsCollection = collectionConfig({
  path: "/workspaces/:workspaceId/columnSettings/:settingId" as const,
  fieldKeys: [] as const,
  schema: columnSettingDataSchema,
  createExcludedSchema: columnSettingCreateExcludedSchema,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});

export const userColumnSettingQueries = createCollectionQueries(
  userColumnSettingsCollection,
  {
    byTable: (tableKey: string) => ({
      where: [{ field: "tableKey", operator: "==" as const, value: tableKey }],
    }),
  },
);

export const workspaceColumnSettingQueries = createCollectionQueries(
  workspaceColumnSettingsCollection,
  {
    byTable: (tableKey: string) => ({
      where: [{ field: "tableKey", operator: "==" as const, value: tableKey }],
    }),
  },
);
