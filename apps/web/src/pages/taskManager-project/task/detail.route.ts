import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { projectLayoutRoute } from "../layout.route";

export const taskDetailRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "tasks/$taskId",
  component: lazyRouteComponent(() => import("./detail")),
});
