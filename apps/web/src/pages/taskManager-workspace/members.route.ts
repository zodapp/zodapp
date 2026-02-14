import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "./layout.route";

export const membersRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "members",
  component: lazyRouteComponent(() => import("./members")),
});
