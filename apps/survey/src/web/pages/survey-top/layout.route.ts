import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyRoute } from "./index.route";

export const topLayoutRoute = createRoute({
  getParentRoute: () => surveyRoute,
  id: "survey-top",
  component: lazyRouteComponent(() => import("./Layout")),
});
