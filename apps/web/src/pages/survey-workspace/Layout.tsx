import {
  IconChevronLeft,
  IconClipboardList,
  IconInbox,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { surveyDemo } from "../../shared/demos";
import { surveyWorkspaceLayoutRoute } from "./layout.route";
import { surveysRoute } from "./surveys.route";
import { responsesRoute } from "./responses.route";
import { surveyWorkspacesRoute } from "../survey-top/workspaces.route";

const SurveyWorkspaceLayout = () => {
  const { workspaceId } = useParams({
    from: surveyWorkspaceLayoutRoute.id,
  });

  const backLink: BackLink = {
    label: "ワークスペース一覧",
    icon: <IconChevronLeft size={20} />,
    to: surveyWorkspacesRoute.to,
  };

  const navItems: NavItem[] = [
    {
      label: "アンケート一覧",
      icon: <IconClipboardList size={20} />,
      to: surveysRoute.to,
      params: { workspaceId },
      exact: false,
    },
    {
      label: "回答一覧",
      icon: <IconInbox size={20} />,
      to: responsesRoute.to,
      params: { workspaceId },
      exact: false,
    },
  ];

  return (
    <AuthGuard>
      <CommonLayout
        navItems={navItems}
        backLink={backLink}
        demo={surveyDemo}
      />
    </AuthGuard>
  );
};

export default SurveyWorkspaceLayout;
