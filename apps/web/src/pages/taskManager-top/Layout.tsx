import { IconChevronLeft, IconFolder } from "@tabler/icons-react";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { workspacesRoute } from "./workspaces.route";
import { homeRoute } from "../top/home/index.route";

const TopLayout = () => {
  const backLink: BackLink = {
    label: "トップに戻る",
    icon: <IconChevronLeft size={20} />,
    to: homeRoute.to,
  };

  const navItems: NavItem[] = [
    {
      label: "ワークスペース一覧",
      icon: <IconFolder size={20} />,
      to: workspacesRoute.to,
      exact: true,
    },
  ];

  return (
    <AuthGuard>
      <CommonLayout navItems={navItems} backLink={backLink} />
    </AuthGuard>
  );
};

export default TopLayout;
