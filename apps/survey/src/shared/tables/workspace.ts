import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import { appTable } from "../table";
import { createOps, isAdmin, isMember } from "../context";
import { newId, stampCreate, stampWrite, timestamps, patchOf } from "./common";
import { memberCreateSchema } from "./member";

export const workspaceBodySchema = z
  .object({
    name: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "ワークスペース名" }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "textarea" })
      .optional(),
  })
  .register(zf.object.registry, {});

export const workspaceSchema = z.object({
  workspaceId: z.string(),
  ...workspaceBodySchema.shape,
  /** 作成者の email */
  ownerId: zf.string().register(zf.hidden.registry, {}),
  ...timestamps.shape,
});

export const workspaces = tableConfig({
  table: appTable,
  entity: "Workspace",
  item: workspaceSchema,
  create: workspaceBodySchema.extend({ ownerId: z.string() }),
  key: { partition: ["workspaceId"] },
  onCreate: stampCreate,
  onWrite: stampWrite,
});

export const workspaceOps = createOps(workspaces, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  update: o.mutation({
    params: patchOf(workspaceBodySchema),
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
    patch: (p) => p,
  }),
  /** 作成はワークスペースとオーナーのメンバーを一度に作るので、サーバーのルートで行う */
  create: o.create(),
}));

/**
 * ワークスペースの作成（POST /api/workspaces）。作成者はオーナーとして、追加のメンバーと一緒に
 * 1 回のトランザクションで登録する。
 */
export const createWorkspaceRequestSchema = z.object({
  workspace: workspaceBodySchema,
  /** 作成者の表示名 */
  ownerDisplayName: z.string().min(1),
  members: z.array(memberCreateSchema).max(90).default([]),
});

export const newWorkspaceId = newId;
