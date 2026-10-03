import { IconChevronLeft, IconFolder } from "@tabler/icons-react";

import CommonLayout, {
  type NavItem,
  type BackLink,
} from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { surveyDemo } from "../../shared/demos";
import { surveyWorkspacesRoute } from "./workspaces.route";
import { homeRoute } from "../top/home/index.route";

const SurveyTopLayout = () => {
  const backLink: BackLink = {
    label: "トップに戻る",
    icon: <IconChevronLeft size={20} />,
    to: homeRoute.to,
  };

  const navItems: NavItem[] = [
    {
      label: "ワークスペース一覧",
      icon: <IconFolder size={20} />,
      to: surveyWorkspacesRoute.to,
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

export default SurveyTopLayout;
