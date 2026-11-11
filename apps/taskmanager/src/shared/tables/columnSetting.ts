import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { appTable } from "../table";
import { createOps, isMember, type Auth } from "../context";
import { newId, stampCreate, stampWrite, patchOf } from "./common";

/**
 * 一覧の列設定のプロファイル。zodapp では「個人」（/users/:uid/columnSettings）と
 * 「ワークスペース共通」（/workspaces/:id/columnSettings）の 2 つのコレクションだったものを、
 * 範囲（scope）と持ち主（ownerId）をキーにした 1 つの Table定義にする。
 */
export const columnSettingScopeSchema = z.enum(["user", "team"]);

const columnEntrySchema = z.object({
  id: z.string(),
  fieldPath: z.string().optional(),
  width: z.string(),
});

const columnSettingBodySchema = z.object({
  name: z.string().min(1),
  columns: z.array(columnEntrySchema).nullable(),
});

export const columnSettingSchema = z.object({
  scope: columnSettingScopeSchema,
  /** user なら利用者の sub、team ならワークスペースの ID */
  ownerId: z.string(),
  /** テーブルの識別子（例："task"） */
  tableKey: z.string(),
  settingId: z.string(),
  ...columnSettingBodySchema.shape,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const columnSettings = tableConfig({
  table: appTable,
  entity: "ColumnSetting",
  item: columnSettingSchema,
  create: columnSettingBodySchema,
  key: {
    partition: ["scope", "ownerId"],
    sort: ["tableKey", "settingId"],
  },
  generateKey: {
    args: z.object({
      scope: columnSettingScopeSchema,
      ownerId: z.string(),
      tableKey: z.string(),
    }),
    key: (args) => ({ ...args, settingId: newId() }),
  },
  onCreate: stampCreate,
  onWrite: stampWrite,
});

const canUse = (
  ctx: Auth,
  owner: { scope: "user" | "team"; ownerId: string },
) =>
  owner.scope === "user"
    ? owner.ownerId === ctx.userId
    : isMember(ctx, owner.ownerId);

export const columnSettingOps = createOps(columnSettings, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => canUse(ctx, key) }),
  byTable: o.query({
    params: z.object({
      scope: columnSettingScopeSchema,
      ownerId: z.string(),
      tableKey: z.string(),
    }),
    authorize: (ctx, { params }) => canUse(ctx, params),
    where: (p) => ({
      partition: { scope: p.scope, ownerId: p.ownerId },
      sort: { tableKey: p.tableKey },
    }),
  }),
  create: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => canUse(ctx, args),
  }),
  update: o.mutation({
    params: patchOf(columnSettingBodySchema),
    authorize: (ctx, { key }) => canUse(ctx, key),
    patch: (p) => p,
  }),
  remove: o.delete({ authorize: (ctx, { key }) => canUse(ctx, key) }),
}));
