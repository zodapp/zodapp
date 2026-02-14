import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "./layout.route";

export const workspaceDetailRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./detail")),
});
