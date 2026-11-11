import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { projectLayoutRoute } from "./layout.route";

export const projectDetailRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./detail")),
});
