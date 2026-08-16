import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyWorkspaceLayoutRoute } from "./layout.route";

export const surveyTestDataRoute = createRoute({
  getParentRoute: () => surveyWorkspaceLayoutRoute,
  path: "testData",
  component: lazyRouteComponent(() => import("./testData")),
});
