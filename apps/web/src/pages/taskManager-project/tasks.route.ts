import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { projectLayoutRoute } from "./layout.route";
import { taskPriorityLiterals, taskStatusLiterals } from "../../shared/taskManager/collections/task";

export const searchFilterSchema = zf
  .object({
    status: zf
      .enum(taskStatusLiterals)
      .register(zf.enum.registry, { label: "ステータス", uiType: "badge" })
      .nullable()
      .optional(),
    priority: zf
      .enum(taskPriorityLiterals)
      .register(zf.enum.registry, { label: "優先度", uiType: "badge" })
      .nullable()
      .optional(),
    dueAt: zf
      .object({
        $gte: zf
          .date()
          .register(zf.date.registry, { label: "期限（From）" })
          .optional(),
        $lte: zf
          .date()
          .register(zf.date.registry, { label: "期限（To）" })
          .optional(),
      })
      .register(zf.object.registry, { uiType: "horizontal" })
      .optional(),
  })
  .register(zf.object.registry, { uiType: "horizontal" });

const searchSchema = z.object({
  q: searchFilterSchema.optional(),
});

export const tasksRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "tasks",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./tasks")),
});
