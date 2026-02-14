import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { workspaceLayoutRoute } from "./layout.route";
import { projectStatusLiterals } from "../../shared/taskManager/collections/project";

// プロジェクト名の部分一致検索スキーマ
export const searchFilterSchema = zf
  .object({
    name: zf
      .object({
        $contains: zf
          .string()
          .register(zf.string.registry, { label: "プロジェクト名" })
          .optional(),
      })
      .register(zf.object.registry, { uiType: "flatten" })
      .optional(),
    status: zf
      .enum(projectStatusLiterals)
      .register(zf.enum.registry, { label: "ステータス", uiType: "badge" })
      .optional(),
  })
  .register(zf.object.registry, { uiType: "horizontal" });

const searchSchema = z.object({
  q: searchFilterSchema.optional(),
});

export const projectsRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "projects",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./projects")),
});
