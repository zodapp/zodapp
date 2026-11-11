import { Navigate, Outlet, useLocation } from "@tanstack/react-router";

import { workspacesRoute } from "./workspaces.route";
import { taskManagerRoute } from "./index.route";

const TaskManagerPage = () => {
  const location = useLocation();
  if (location.pathname === taskManagerRoute.to) {
    return <Navigate to={workspacesRoute.to} replace />;
  }
  return <Outlet />;
};

export default TaskManagerPage;
