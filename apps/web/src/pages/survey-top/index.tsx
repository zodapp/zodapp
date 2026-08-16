import { Navigate, Outlet, useLocation } from "@tanstack/react-router";

import { surveyRoute } from "./index.route";
import { surveyWorkspacesRoute } from "./workspaces.route";

const SurveyPage = () => {
  const location = useLocation();
  if (location.pathname === surveyRoute.to) {
    return <Navigate to={surveyWorkspacesRoute.to} replace />;
  }
  return <Outlet />;
};

export default SurveyPage;
