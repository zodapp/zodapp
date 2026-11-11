import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { nonMemberLayoutRoute } from "./layout.route";

export const loginRoute = createRoute({
  getParentRoute: () => nonMemberLayoutRoute,
  path: "login",
  component: lazyRouteComponent(() => import("./login")),
});
