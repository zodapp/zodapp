import type React from "react";
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useMediaQuery, useLocalStorage } from "@mantine/hooks";
import {
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
} from "@tabler/icons-react";
import {
  Link,
  Outlet,
  useNavigate,
  type LinkOptions,
} from "@tanstack/react-router";

import { useAuthContext } from "../shared/auth";
import { loginRoute } from "../pages/taskManager-nonmember/login.route";

import styles from "../styles/page.module.css";

export type NavItem = Pick<LinkOptions, "to" | "params" | "search"> & {
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
};

export type BackLink = Pick<LinkOptions, "to" | "params"> & {
  label: string;
  icon: React.ReactNode;
};

export interface ExtraNavContentProps {
  closeMobile: () => void;
}

export interface CommonLayoutProps {
  navItems: NavItem[];
  backLink?: BackLink;
  extraNavContent?: (props: ExtraNavContentProps) => React.ReactNode;
}

const CommonLayout: React.FC<CommonLayoutProps> = ({
  navItems,
  backLink,
  extraNavContent,
}) => {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const [desktopOpened, setDesktopOpened] = useLocalStorage({
    key: "sidebar-desktop-opened",
    defaultValue: true,
  });
  const toggleDesktop = () => setDesktopOpened((prev) => !prev);
  const isMobile = useMediaQuery("(max-width: 48em)");
  const { user, signOut } = useAuthContext();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: loginRoute.to, replace: true });
  };

  const renderBackLink = () => {
    if (!backLink) return null;

    if (isMobile || desktopOpened) {
      return (
        <NavLink
          label={backLink.label}
          component={Link}
          to={backLink.to}
          // Mantine NavLink polymorphic component type doesn't fully support TanStack Router's params
          {...({ params: backLink.params } as object)}
          onClick={closeMobile}
          activeOptions={{ exact: true }}
          leftSection={
            <ActionIcon variant="transparent" color="dimmed" size="lg" my={5}>
              {backLink.icon}
            </ActionIcon>
          }
          style={
            {
              padding: 0,
              marginBottom: 8,
              "--mantine-spacing-sm": 0,
            } as React.CSSProperties
          }
        />
      );
    }
    return (
      <Tooltip label={backLink.label} position="right">
        <Link
          to={backLink.to}
          params={backLink.params}
          onClick={closeMobile}
          activeOptions={{ exact: true }}
        >
          <ActionIcon variant="transparent" color="dimmed" size="lg" my={5}>
            {backLink.icon}
          </ActionIcon>
        </Link>
      </Tooltip>
    );
  };

  const renderNavItem = (item: NavItem) => {
    if (isMobile || desktopOpened) {
      return (
        <NavLink
          key={item.label}
          label={item.label}
          component={Link}
          to={item.to}
          // Mantine NavLink polymorphic component type doesn't fully support TanStack Router's params/search
          {...({ params: item.params, search: item.search } as object)}
          activeOptions={{ exact: item.exact, includeSearch: !!item.search }}
          onClick={closeMobile}
          leftSection={
            <ActionIcon variant="transparent" size="lg" my={5}>
              {item.icon}
            </ActionIcon>
          }
          style={{ padding: 0 }}
        />
      );
    }
    return (
      <Tooltip key={item.label} label={item.label} position="right">
        <Link
          to={item.to}
          params={item.params}
          search={item.search}
          activeOptions={{ exact: item.exact, includeSearch: !!item.search }}
          onClick={closeMobile}
        >
          {({ isActive }: { isActive: boolean }) => (
            <ActionIcon
              variant={isActive ? "filled" : "subtle"}
              size="lg"
              my={5}
            >
              {item.icon}
            </ActionIcon>
          )}
        </Link>
      </Tooltip>
    );
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: desktopOpened ? 200 : 60,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Group gap="xs">
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            hiddenFrom="sm"
            size="sm"
            ml="md"
          />
          <Tooltip
            label={desktopOpened ? "サイドバーを閉じる" : "サイドバーを開く"}
            position="bottom"
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={toggleDesktop}
              size="lg"
              visibleFrom="sm"
              ml="md"
            >
              {desktopOpened ? (
                <IconLayoutSidebarLeftCollapse size={20} />
              ) : (
                <IconLayoutSidebarLeftExpand size={20} />
              )}
            </ActionIcon>
          </Tooltip>
          <img
            className={styles.logo}
            src="/zodapp-logo.svg"
            alt="zodapp logomark"
            width={120}
            height={60}
          />
          <span style={{ fontSize: "0.8em" }}>
            An AI-native schema-driven development framework
          </span>
        </Group>

        {user && (
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <UnstyledButton mr="md">
                <Group gap="xs">
                  <Avatar
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    radius="xl"
                    size="sm"
                  />
                  <Text size="sm" visibleFrom="sm">
                    {user.displayName || user.email}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={14} />}
                onClick={handleSignOut}
              >
                ログアウト
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {renderBackLink()}
        {navItems.map(renderNavItem)}
        {extraNavContent?.({ closeMobile })}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default CommonLayout;
