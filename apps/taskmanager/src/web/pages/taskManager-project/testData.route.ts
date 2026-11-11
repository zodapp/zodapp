import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { projectLayoutRoute } from "./layout.route";

export const taskTestDataRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "testData",
  component: lazyRouteComponent(() => import("./testData")),
});
