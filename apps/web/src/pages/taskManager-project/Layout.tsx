import {
  IconChevronLeft,
  IconSettings,
  IconChecklist,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { projectLayoutRoute } from "./layout.route";
import { projectDetailRoute } from "./detail.route";
import { tasksRoute } from "./tasks.route";
import { projectsRoute } from "../taskManager-workspace/projects.route";

const ProjectLayout = () => {
  const { workspaceId, projectId } = useParams({
    from: projectLayoutRoute.id,
  });

  const backLink: BackLink = {
    label: "プロジェクト一覧",
    icon: <IconChevronLeft size={20} />,
    to: projectsRoute.to,
    params: { workspaceId },
  };

  const navItems: NavItem[] = [
    {
      label: "タスク一覧",
      icon: <IconChecklist size={20} />,
      to: tasksRoute.to,
      params: { workspaceId, projectId },
      exact: false,
    },
    {
      label: "プロジェクト詳細",
      icon: <IconSettings size={20} />,
      to: projectDetailRoute.to,
      params: { workspaceId, projectId },
      exact: true,
    },
  ];

  return (
    <AuthGuard>
      <CommonLayout navItems={navItems} backLink={backLink} />
    </AuthGuard>
  );
};

export default ProjectLayout;
