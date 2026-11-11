import {
  IconForms,
  IconHome2,
} from "@tabler/icons-react";

import CommonLayout, { type NavItem } from "../../components/CommonLayout";
import { homeRoute } from "./home/index.route";
import { formListRoute } from "../form/list.route";

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
  ];

  return <CommonLayout navItems={navItems} />;
};

export default MainLayout;
