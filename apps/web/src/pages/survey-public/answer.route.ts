import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyPublicLayoutRoute } from "./layout.route";

// URL は管理画面配下と同じ形のまま（/survey/workspaces/:workspaceId/...）だが、
// 親レイアウトが管理画面ではないので、サイドバーは出ない
export const surveyAnswerRoute = createRoute({
  getParentRoute: () => surveyPublicLayoutRoute,
  path: "workspaces/$workspaceId/surveys/$surveyId/answer",
  component: lazyRouteComponent(() => import("./answer")),
});
