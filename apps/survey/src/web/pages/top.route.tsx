import { createRoute, Navigate } from "@tanstack/react-router";

import { rootRoute } from "./index.route";

/** トップはアンケートに直行する（zodapp のデモ一覧のページは移植しない） */
export const topRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/survey" replace />,
});
