import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyRoute } from "../survey-top/index.route";

export const surveyWorkspaceLayoutRoute = createRoute({
  getParentRoute: () => surveyRoute,
  path: "workspaces/$workspaceId",
  component: lazyRouteComponent(() => import("./Layout")),
});
