import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "../layout.route";

export const responseDetailRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "responses/$responseId",
  component: lazyRouteComponent(() => import("./detail")),
});
