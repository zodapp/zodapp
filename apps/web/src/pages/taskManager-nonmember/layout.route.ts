import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { taskManagerRoute } from "../taskManager-top/index.route";

export const nonMemberLayoutRoute = createRoute({
  getParentRoute: () => taskManagerRoute,
  id: "taskManager-nonmember",
  component: lazyRouteComponent(() => import("./Layout")),
});
