import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "./layout.route";

export const surveysRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "surveys",
  component: lazyRouteComponent(() => import("./surveys")),
});
