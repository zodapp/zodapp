import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

// メンバーロールのリテラル定義
const memberRoleLiterals = {
  owner: z
    .literal("owner")
    .register(zf.literal.registry, { label: "オーナー" }),
  admin: z.literal("admin").register(zf.literal.registry, { label: "管理者" }),
  member: z
    .literal("member")
    .register(zf.literal.registry, { label: "メンバー" }),
  viewer: z
    .literal("viewer")
    .register(zf.literal.registry, { label: "閲覧者" }),
} as const;

export const memberRoleSchema = zf
  .enum([
    memberRoleLiterals.owner,
    memberRoleLiterals.admin,
    memberRoleLiterals.member,
    memberRoleLiterals.viewer,
  ] as const)
  .register(zf.enum.registry, { label: "ロール" });

export type MemberRole = z.infer<typeof memberRoleSchema>;

const memberDataSchema = z
  .object({
    // 表示情報
    displayName: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "表示名" }),
    email: z
      .email("有効なメールアドレスを入力してください")
      .register(zf.string.registry, { label: "メールアドレス" }),
    avatarUrl: zf
      .string()
      .url()
      .register(zf.string.registry, { label: "アバターURL" })
      .optional(),

    // 権限
    role: memberRoleSchema,

    // タイムスタンプ
    createdAt: zf
      .date()
      .register(zf.date.registry, { label: "作成日", readOnly: true })
      .optional(),
    updatedAt: zf
      .date()
      .register(zf.date.registry, { label: "更新日", readOnly: true })
      .optional(),
  })
  .register(zf.object.registry, {});

export const membersCollection = collectionConfig({
  path: "/workspaces/:workspaceId/members/:memberId" as const,
  fieldKeys: [] as const,
  schema: memberDataSchema,
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  /** docId に email を使用（同一ワークスペース内でメール一意） */
  onCreateId: (_collectionIdentity, inputData) => inputData.email,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
  // 外部キー用設定（担当者選択などで使用）
  externalKeyConfig: {
    labelField: "displayName",
    valueField: "memberId",
  },
});
