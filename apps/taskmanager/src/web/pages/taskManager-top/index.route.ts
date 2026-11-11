import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { rootRoute } from "../index.route";

export const taskManagerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "taskManager",
  component: lazyRouteComponent(() => import("./index")),
});
