import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { rootRoute } from "../index.route";

export const formRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/form",
  component: lazyRouteComponent(() => import("./Layout")),
});
