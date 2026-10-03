import { z } from "zod";
import {
  collectionConfig,
  createCollectionMutations,
  createCollectionQueries,
  createCollectionReference,
} from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

import { surveyFieldsSchema } from "../fieldDefs";

// アンケート定義。回答（responses）とはサブコレクションにせず
// 同じ階層（兄弟コレクション）に置くことで、回答の横断検索を可能にしている
// （responses 側は surveyId を通常フィールドとして持つ。collections/response.ts 参照）

export const surveyStatusLiterals = [
  z
    .literal("draft")
    .register(zf.literal.registry, { label: "下書き", color: "gray" }),
  z
    .literal("published")
    .register(zf.literal.registry, { label: "公開中", color: "green" }),
  z
    .literal("closed")
    .register(zf.literal.registry, { label: "終了", color: "orange" }),
] as const;

export const surveyStatusSchema = zf
  .enum(surveyStatusLiterals)
  .register(zf.enum.registry, {
    label: "状態",
    uiType: "badge",
    width: 90,
  });

export type SurveyStatus = z.infer<typeof surveyStatusSchema>;

const surveyDataSchema = z
  .object({
    title: zf
      .string()
      .min(1, "アンケート名を入力してください")
      .register(zf.string.registry, { label: "アンケート名", width: 200 }),
    description: zf
      .string()
      .register(zf.string.registry, {
        label: "説明",
        uiType: "multiline",
        width: 200,
      })
      .optional(),
    status: surveyStatusSchema.default("draft"),

    // 質問定義（DSL）。実行時に buildSurveySchema() で回答フォーム用スキーマになる
    fields: surveyFieldsSchema,

    deletedAt: zf
      .date()
      .register(zf.date.registry, { label: "削除日", width: 100 })
      .nullable()
      // hidden フラグは一番外側に付ける必要がある
      .register(zf.common.registry, { hidden: true }),
  })
  .register(zf.object.registry, {});

const surveyCreateExcludedSchema = z.object({
  revision: zf
    .number()
    .register(zf.number.registry, {
      label: "公開版",
      readOnly: true,
      width: 70,
    })
    .optional(),
  publishedAt: zf
    .date()
    .register(zf.date.registry, {
      label: "公開日時",
      readOnly: true,
      width: 130,
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
});

export const surveysCollection = collectionConfig({
  path: "/workspaces/:workspaceId/surveys/:surveyId" as const,
  fieldKeys: [] as const,
  schema: surveyDataSchema,
  createExcludedSchema: surveyCreateExcludedSchema,

  onCreate: () => ({ createdAt: new Date(), revision: 0 }),
  onWrite: () => ({ updatedAt: new Date() }),

  // フォーム初期化時のデフォルト値
  onInit: () => ({
    status: "draft" as const,
    fields: [],
    deletedAt: null,
  }),
});

// 回答（responses）から参照するための外部キー設定
export const surveysReference = createCollectionReference(surveysCollection, {
  labelField: "title",
});

export const surveyMutations = createCollectionMutations(surveysCollection, {
  softDelete: () => ({ deletedAt: new Date() }),
  restore: () => ({ deletedAt: null }),
  close: () => ({ status: "closed" as const }),
  reopen: () => ({ status: "published" as const }),
});

export const surveyQueries = createCollectionQueries(surveysCollection, {
  active: () => ({
    where: [{ field: "deletedAt", operator: "==" as const, value: null }],
  }),
  // 論理削除済み（ゴミ箱）。"!=" は同じフィールドを先頭の orderBy に置く必要がある
  deleted: () => ({
    where: [{ field: "deletedAt", operator: "!=" as const, value: null }],
    orderBy: [{ field: "deletedAt", direction: "desc" as const }],
  }),
  published: () => ({
    where: [
      { field: "deletedAt", operator: "==" as const, value: null },
      { field: "status", operator: "==" as const, value: "published" },
    ],
  }),
});
