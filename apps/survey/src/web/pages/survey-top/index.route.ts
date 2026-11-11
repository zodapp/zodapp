import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { rootRoute } from "../index.route";

export const surveyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "survey",
  component: lazyRouteComponent(() => import("./index")),
});
