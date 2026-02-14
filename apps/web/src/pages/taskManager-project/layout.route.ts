import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { taskManagerRoute } from "../taskManager-top/index.route";

export const projectLayoutRoute = createRoute({
  getParentRoute: () => taskManagerRoute,
  path: "workspaces/$workspaceId/projects/$projectId",
  component: lazyRouteComponent(() => import("./Layout")),
});
