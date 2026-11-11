import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { taskManagerRoute } from "./index.route";

export const topLayoutRoute = createRoute({
  getParentRoute: () => taskManagerRoute,
  id: "taskManager-top",
  component: lazyRouteComponent(() => import("./Layout")),
});
