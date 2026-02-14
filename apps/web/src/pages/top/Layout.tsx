import { IconForms, IconHome2, IconChecklist } from "@tabler/icons-react";

import CommonLayout, { type NavItem } from "../../components/CommonLayout";
import { homeRoute } from "./home/index.route";
import { formListRoute } from "../form/list.route";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

const MainLayout = () => {
  const navItems: NavItem[] = [
    {
      label: "トップ",
      icon: <IconHome2 size={20} />,
      to: homeRoute.to,
      exact: true,
    },
    {
      label: "フォームデモ",
      icon: <IconForms size={20} />,
      to: formListRoute.to,
    },
    {
      label: "アプリデモ",
      icon: <IconChecklist size={20} />,
      to: workspacesRoute.to,
      exact: false,
    },
  ];

  return <CommonLayout navItems={navItems} />;
};

export default MainLayout;
