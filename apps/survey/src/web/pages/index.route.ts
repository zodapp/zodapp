import { createRootRoute } from "@tanstack/react-router";

import { RootLayout } from "./layout";

export const rootRoute = createRootRoute({
  component: RootLayout,
});
