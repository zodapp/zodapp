import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import { formRoute } from "./index.route";

export const formListRoute = createRoute({
  getParentRoute: () => formRoute,
  path: "list",
  component: lazyRouteComponent(() => import("./list")),
});
