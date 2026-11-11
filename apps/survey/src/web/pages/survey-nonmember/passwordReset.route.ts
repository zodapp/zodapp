import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { nonMemberLayoutRoute } from "./layout.route";

export const passwordResetRoute = createRoute({
  getParentRoute: () => nonMemberLayoutRoute,
  path: "passwordReset",
  component: lazyRouteComponent(() => import("./passwordReset")),
});
