import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { surveyWorkspaceLayoutRoute } from "./layout.route";
import {
  surveyQueries,
  surveysReference,
} from "../../shared/survey/collections";

// 回答一覧の検索条件。
// surveyId は Firestore の where（named query bySurvey）に、
// 回答日の範囲はクライアントフィルタに割り当てる（tasks 一覧と同じ分担）
export const searchFilterSchema = zf
  .object({
    surveyId: zf
      .string()
      .register(zf.externalKey.registry, {
        label: "アンケート",
        externalKeyConfig: {
          type: "firestore",
          reference: surveysReference,
          contextId: "workspace",
          getQuery: () => surveyQueries.queries.active(),
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
  getParentRoute: () => surveyWorkspaceLayoutRoute,
  path: "responses",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./responses")),
});
