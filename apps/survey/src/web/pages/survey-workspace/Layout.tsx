import {
  IconChevronLeft,
  IconClipboardList,
  IconFlask,
  IconInbox,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { surveyDemo } from "../../shared/demos";
import { workspaceLayoutRoute } from "./layout.route";
import { workspaceDetailRoute } from "./detail.route";
import { surveysRoute } from "./surveys.route";
import { responsesRoute } from "./responses.route";
import { surveyTestDataRoute } from "./testData.route";
import { membersRoute } from "./members.route";
import { workspacesRoute } from "../survey-top/workspaces.route";

const WorkspaceLayout = () => {
  const { workspaceId } = useParams({
    from: workspaceLayoutRoute.id,
  });

  const backLink: BackLink = {
    label: "ワークスペース一覧",
    icon: <IconChevronLeft size={20} />,
    to: workspacesRoute.to,
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
    {
      label: "テストデータ",
      icon: <IconFlask size={20} />,
      to: surveyTestDataRoute.to,
      params: { workspaceId },
      exact: true,
    },
    {
      label: "メンバー一覧",
      icon: <IconUsers size={20} />,
      to: membersRoute.to,
      params: { workspaceId },
      exact: true,
    },
    {
      label: "ワークスペース詳細",
      icon: <IconSettings size={20} />,
      to: workspaceDetailRoute.to,
      params: { workspaceId },
      exact: true,
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

export default WorkspaceLayout;
