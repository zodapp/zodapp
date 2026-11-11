import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyPublicLayoutRoute } from "./layout.route";

// URL は管理画面の下と同じ形（/survey/workspaces/:workspaceId/...）だが、
// 親のレイアウトが管理画面ではないので、サイドバーは出ない
export const surveyAnswerRoute = createRoute({
  getParentRoute: () => surveyPublicLayoutRoute,
  path: "workspaces/$workspaceId/surveys/$surveyId/answer",
  component: lazyRouteComponent(() => import("./answer")),
});
