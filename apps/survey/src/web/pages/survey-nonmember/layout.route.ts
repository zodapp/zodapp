import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyRoute } from "../survey-top/index.route";

export const nonMemberLayoutRoute = createRoute({
  getParentRoute: () => surveyRoute,
  id: "survey-nonmember",
  component: lazyRouteComponent(() => import("./Layout")),
});
