import { createRoute, Navigate } from "@tanstack/react-router";

import { rootRoute } from "./index.route";

/** トップはタスク管理に直行する（zodapp のデモ一覧のページは移植しない） */
export const topRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/taskManager" replace />,
});
