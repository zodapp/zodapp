import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { rootRoute } from "../index.route";

export const topRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "top-layout",
  component: lazyRouteComponent(() => import("./Layout")),
});
