import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyWorkspaceLayoutRoute } from "../layout.route";

export const surveyAnswerRoute = createRoute({
  getParentRoute: () => surveyWorkspaceLayoutRoute,
  path: "surveys/$surveyId/answer",
  component: lazyRouteComponent(() => import("./answer")),
});
