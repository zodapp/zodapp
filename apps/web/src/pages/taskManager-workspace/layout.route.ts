import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { taskManagerRoute } from "../taskManager-top/index.route";

export const workspaceLayoutRoute = createRoute({
  getParentRoute: () => taskManagerRoute,
  path: "workspaces/$workspaceId",
  component: lazyRouteComponent(() => import("./Layout")),
});
