import {
  IconChevronLeft,
  IconFolder,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { workspaceLayoutRoute } from "./layout.route";
import { workspaceDetailRoute } from "./detail.route";
import { projectsRoute } from "./projects.route";
import { membersRoute } from "./members.route";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

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
      label: "プロジェクト一覧",
      icon: <IconFolder size={20} />,
      to: projectsRoute.to,
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
      <CommonLayout navItems={navItems} backLink={backLink} />
    </AuthGuard>
  );
};

export default WorkspaceLayout;
