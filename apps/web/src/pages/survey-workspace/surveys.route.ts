import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyWorkspaceLayoutRoute } from "./layout.route";

export const surveysRoute = createRoute({
  getParentRoute: () => surveyWorkspaceLayoutRoute,
  path: "surveys",
  component: lazyRouteComponent(() => import("./surveys")),
});
