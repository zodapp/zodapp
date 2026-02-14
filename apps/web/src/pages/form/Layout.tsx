import { ActionIcon, NavLink, Tooltip, Divider, Text } from "@mantine/core";
import { useMediaQuery, useLocalStorage } from "@mantine/hooks";
import { IconChevronLeft, IconList } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import CommonLayout, {
  type NavItem,
  type BackLink,
  type ExtraNavContentProps,
} from "../../components/CommonLayout";
import { homeRoute } from "../top/home/index.route";
import { formDetailRoute } from "./detail.route";
import { formListRoute } from "./list.route";
import { formSchemas, formIds } from "./schemas";

const MainLayout = () => {
  const [desktopOpened] = useLocalStorage({
    key: "sidebar-desktop-opened",
    defaultValue: true,
  });
  const isMobile = useMediaQuery("(max-width: 48em)");

  const backLink: BackLink = {
    label: "トップに戻る",
    icon: <IconChevronLeft size={20} />,
    to: homeRoute.to,
  };

  const navItems: NavItem[] = [
    {
      label: "一覧",
      icon: <IconList size={20} />,
      to: formListRoute.to,
      exact: true,
    },
  ];

  // スキーマ一覧のナビゲーションアイテム
  const schemaNavItems = formIds.map((formId) => ({
    label: formSchemas[formId].title,
    icon: formSchemas[formId].icon,
    formId,
  }));

  const renderSchemaNavItem = (
    item: (typeof schemaNavItems)[number],
    closeMobile: () => void,
  ) => {
    if (isMobile || desktopOpened) {
      return (
        <NavLink
          key={item.formId}
          label={item.label}
          component={Link}
          to={formDetailRoute.to}
          {...({ search: { formId: item.formId } } as object)}
          activeOptions={{ includeSearch: true }}
          onClick={closeMobile}
          leftSection={
            <ActionIcon variant="transparent" size="sm" my={2}>
              <item.icon size={16} />
            </ActionIcon>
          }
          style={{
            padding: "5px 0 5px 8px",
            cursor: "pointer",
          }}
        />
      );
    }
    return (
      <Tooltip key={item.formId} label={item.label} position="right">
        <Link
          to={formDetailRoute.to}
          search={{ formId: item.formId }}
          activeOptions={{ includeSearch: true }}
          onClick={closeMobile}
        >
          {({ isActive }: { isActive: boolean }) => (
            <ActionIcon
              variant={isActive ? "filled" : "subtle"}
              size="md"
              my={2}
              style={{ cursor: "pointer" }}
            >
              <item.icon size="20" />
            </ActionIcon>
          )}
        </Link>
      </Tooltip>
    );
  };

  const extraNavContent = ({ closeMobile }: ExtraNavContentProps) => (
    <>
      <Divider my="sm" />
      {(isMobile || desktopOpened) && (
        <Text size="xs" c="dimmed" fw={500} mb="xs" px="xs">
          スキーマ一覧
        </Text>
      )}
      {schemaNavItems.map((item) => renderSchemaNavItem(item, closeMobile))}
    </>
  );

  return (
    <CommonLayout
      navItems={navItems}
      backLink={backLink}
      extraNavContent={extraNavContent}
    />
  );
};

export default MainLayout;
