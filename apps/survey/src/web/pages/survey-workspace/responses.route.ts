import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { workspaceLayoutRoute } from "./layout.route";

// 回答一覧の検索条件。
// surveyId は Index（名前付きクエリ bySurvey）で読み分け、
// 回答日の範囲は読んだ一覧をブラウザで絞る（tasks 一覧と同じ分担）
export const searchFilterSchema = zf
  .object({
    surveyId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "アンケート",
        externalKeyConfig: {
          type: "dynamodb",
          contextId: "workspace",
          query: "surveys.active",
          params: (context) => ({ workspaceId: context.workspaceId }),
          valueField: "surveyId",
          labelField: "title",
        },
      })
      .nullable()
      .optional(),
    submittedAt: zf
      .object({
        $gte: zf
          .date()
          .register(zf.date.registry, { label: "回答日（From）" })
          .optional(),
        $lte: zf
          .date()
          .register(zf.date.registry, { label: "回答日（To）" })
          .optional(),
      })
      .register(zf.object.registry, { uiType: "horizontal-wrap" })
      .optional(),
  })
  .register(zf.object.registry, { uiType: "horizontal-wrap" });

const searchSchema = z.object({
  q: searchFilterSchema.optional(),
});

export const responsesRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "responses",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./responses")),
});
