import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyWorkspaceLayoutRoute } from "../layout.route";

export const surveyEditRoute = createRoute({
  getParentRoute: () => surveyWorkspaceLayoutRoute,
  path: "surveys/$surveyId",
  component: lazyRouteComponent(() => import("./edit")),
});
