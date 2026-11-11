import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { topLayoutRoute } from "./layout.route";

export const workspacesRoute = createRoute({
  getParentRoute: () => topLayoutRoute,
  path: "workspaces",
  component: lazyRouteComponent(() => import("./workspaces")),
});
