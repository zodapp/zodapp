import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { surveyRoute } from "../survey-top/index.route";

// 回答者向け（管理画面ではない）画面のレイアウト。
// パスを持たない id 付きルートなので、配下のルートは URL を変えずに
// 管理画面のレイアウトから切り離せる
export const surveyPublicLayoutRoute = createRoute({
  getParentRoute: () => surveyRoute,
  id: "survey-public",
  component: lazyRouteComponent(() => import("./Layout")),
});
