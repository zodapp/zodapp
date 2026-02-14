import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { topRoute } from "../index.route";

export const homeRoute = createRoute({
  getParentRoute: () => topRoute,
  id: "home",
  component: lazyRouteComponent(() => import("./index")),
});
