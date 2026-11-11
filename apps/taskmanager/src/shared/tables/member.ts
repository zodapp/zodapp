import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";
import { zf } from "@zodapp/zod-form";
import "../form";
import { appTable } from "../table";
import { createOps, isAdmin, isMember, type MemberRole } from "../context";
import { stampCreate, stampWrite, timestamps, patchOf } from "./common";

const memberRoleLiterals = {
  owner: z.literal("owner").register(zf.literal.registry, { label: "オーナー" }),
  admin: z.literal("admin").register(zf.literal.registry, { label: "管理者" }),
  member: z.literal("member").register(zf.literal.registry, { label: "メンバー" }),
  viewer: z.literal("viewer").register(zf.literal.registry, { label: "閲覧者" }),
} as const;

export const memberRoleSchema = zf
  .enum([
    memberRoleLiterals.owner,
    memberRoleLiterals.admin,
    memberRoleLiterals.member,
    memberRoleLiterals.viewer,
  ] as const)
  .register(zf.enum.registry, { label: "ロール" });

/** 担当者にできるロール */
export const assignableRoles: readonly MemberRole[] = ["owner", "admin", "member"];

export const memberBodySchema = z
  .object({
    displayName: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "表示名" }),
    avatarImage: zf
      .file()
      .register(zf.file.registry, {
        label: "アバター画像",
        fileConfig: {
          type: "s3",
          contextId: "workspace",
          getLocation: (context) => ({
            prefix: `workspaces/${context.workspaceId}/avatars`,
          }),
          mimeTypes: ["image/*"],
        },
      })
      .optional(),
    role: memberRoleSchema,
  })
  .register(zf.object.registry, {});

/** メンバーの追加のフォーム。zodapp と同じく、email がメンバーのキーになる */
export const memberCreateSchema = z
  .object({
    displayName: memberBodySchema.shape.displayName,
    email: z
      .email("有効なメールアドレスを入力してください")
      .register(zf.string.registry, { label: "メールアドレス" }),
    avatarImage: memberBodySchema.shape.avatarImage,
    role: memberRoleSchema,
  })
  .register(zf.object.registry, {});

export const memberSchema = z.object({
  workspaceId: z.string(),
  email: memberCreateSchema.shape.email,
  ...memberBodySchema.shape,
  ...timestamps.shape,
});

export const members = tableConfig({
  table: appTable,
  entity: "Member",
  item: memberSchema,
  create: memberBodySchema,
  key: { partition: ["workspaceId"], sort: ["email"] },
  indexes: {
    // 自分が所属するワークスペースの一覧（Firestore の collectionGroup の代わり）
    byEmail: { slot: "GSI1", partition: ["email"], sort: ["workspaceId"] },
  },
  onCreate: stampCreate,
  onWrite: stampWrite,
});

const isSelf = (ctx: { email: string }, email: string) =>
  ctx.email.toLowerCase() === email.toLowerCase();

export const memberOps = createOps(members, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) =>
      isMember(ctx, key.workspaceId) || isSelf(ctx, key.email),
  }),
  list: o.query({
    params: z.object({ workspaceId: z.string() }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
  }),
  /** ログインしている利用者の所属一覧。認証コンテキストを作るのにも使う */
  mine: o.query({
    index: "byEmail",
    params: z.object({}),
    authorize: (ctx) => ctx.userId !== "",
    where: (_p, ctx) => ({ partition: { email: ctx.email.toLowerCase() } }),
  }),
  add: o.create({
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
  }),
  update: o.mutation({
    params: patchOf(memberBodySchema),
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
    patch: (p) => p,
  }),
  /** 本人は表示名だけを変えられる（zodapp のルールと同じ） */
  updateProfile: o.mutation({
    params: memberBodySchema.pick({ displayName: true }),
    authorize: (ctx, { key }) => isSelf(ctx, key.email),
    patch: (p) => p,
  }),
  remove: o.delete({
    authorize: (ctx, { key }) => isAdmin(ctx, key.workspaceId),
  }),
}));
