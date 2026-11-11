import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { workspaceLayoutRoute } from "./layout.route";

export const surveyTestDataRoute = createRoute({
  getParentRoute: () => workspaceLayoutRoute,
  path: "test-data",
  component: lazyRouteComponent(() => import("./testData")),
});
