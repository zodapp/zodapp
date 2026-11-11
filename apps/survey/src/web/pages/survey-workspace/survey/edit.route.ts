import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "../layout.route";

export const surveyEditRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "surveys/$surveyId/edit",
  component: lazyRouteComponent(() => import("./edit")),
});
