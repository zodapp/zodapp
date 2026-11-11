import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { formRoute } from "./index.route";

const searchSchema = z.object({
  formId: z.string().optional(),
});

export const formDetailRoute = createRoute({
  getParentRoute: () => formRoute,
  path: "detail",
  // ParamsTree → 型付きオブジェクト（スキーマ依存）
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./detail")),
});
