import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "../layout.route";

export const memberDetailRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "members/$memberId",
  component: lazyRouteComponent(() => import("./detail")),
});
