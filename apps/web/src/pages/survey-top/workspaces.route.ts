import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyTopLayoutRoute } from "./layout.route";

export const surveyWorkspacesRoute = createRoute({
  getParentRoute: () => surveyTopLayoutRoute,
  path: "workspaces",
  component: lazyRouteComponent(() => import("./workspaces")),
});
