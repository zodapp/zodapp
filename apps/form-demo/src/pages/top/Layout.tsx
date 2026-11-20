import { useMsg } from "@zodapp/i18n-messages-react";
import { IconForms, IconHome2 } from "@tabler/icons-react";

import CommonLayout, { type NavItem } from "../../components/CommonLayout";
import { homeRoute } from "./home/index.route";
import { formListRoute } from "../form/list.route";

const MainLayout = () => {
  const msg = useMsg();
  const navItems: NavItem[] = [
    {
      label: msg("formDemo.app.nav.top" /* i18n: トップ */),
      icon: <IconHome2 size={20} />,
      to: homeRoute.to,
      exact: true,
    },
    {
      label: msg("formDemo.app.demo.form.title" /* i18n: フォームデモ */),
      icon: <IconForms size={20} />,
      to: formListRoute.to,
    },
  ];

  return <CommonLayout navItems={navItems} />;
};

export default MainLayout;
