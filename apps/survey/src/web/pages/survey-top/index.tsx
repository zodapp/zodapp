import { Navigate, Outlet, useLocation } from "@tanstack/react-router";

import { workspacesRoute } from "./workspaces.route";
import { surveyRoute } from "./index.route";

const SurveyPage = () => {
  const location = useLocation();
  if (location.pathname === surveyRoute.to) {
    return <Navigate to={workspacesRoute.to} replace />;
  }
  return <Outlet />;
};

export default SurveyPage;
