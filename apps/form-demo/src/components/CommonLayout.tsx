import type React from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Group,
  NavLink,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useMediaQuery, useLocalStorage } from "@mantine/hooks";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import {
  Link,
  Outlet,
  useNavigate,
  type LinkOptions,
} from "@tanstack/react-router";


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
  /**
   * サイドバーに並べるナビゲーション。
   * 省略（または空）で backLink / extraNavContent もない場合はサイドバー自体を
   * 描画しない。回答ページのように「管理画面ではないが、ヘッダーは共通にしたい」
   * 画面のための逃げ道
   */
  navItems?: NavItem[];
  backLink?: BackLink;
  extraNavContent?: (props: ExtraNavContentProps) => React.ReactNode;
  /**
   * いまどのデモを見ているかをヘッダーに表示する（`shared/demos.tsx`）。
   * 複数のデモが同じ見た目を共有しているので、これがないと
   * タスク管理とアンケートのどちらにいるのか画面から判別できない
   */
  demo?: DemoBadge;
}

export type DemoBadge = Pick<LinkOptions, "to"> & {
  label: string;
  icon: React.ReactNode;
  color?: string;
};

const CommonLayout: React.FC<CommonLayoutProps> = ({
  navItems = [],
  backLink,
  extraNavContent,
  demo,
}) => {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const [desktopOpened, setDesktopOpened] = useLocalStorage({
    key: "sidebar-desktop-opened",
    defaultValue: true,
  });
  const toggleDesktop = () => setDesktopOpened((prev) => !prev);
  const isMobile = useMediaQuery("(max-width: 48em)");
  const navigate = useNavigate();

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

  const hasNavbar =
    navItems.length > 0 || backLink != null || extraNavContent != null;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={
        hasNavbar
          ? {
              width: desktopOpened ? 200 : 60,
              breakpoint: "sm",
              collapsed: { mobile: !mobileOpened },
            }
          : undefined
      }
      padding="md"
    >
      <AppShell.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Group gap="xs" ml={hasNavbar ? undefined : "md"}>
          {hasNavbar && (
            <>
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
            </>
          )}
          <img
            className={styles.logo}
            src={`${import.meta.env.BASE_URL}zodapp-logo.svg`}
            alt="zodapp logomark"
            width={120}
            height={60}
          />
          {demo ? (
            <Badge
              component={Link}
              to={demo.to}
              variant="light"
              color={demo.color}
              size="lg"
              radius="sm"
              leftSection={demo.icon}
              style={{ cursor: "pointer", fontWeight: 700 }}
            >
              {demo.label}
            </Badge>
          ) : (
            <span style={{ fontSize: "0.8em" }}>
              An AI-native schema-driven development framework
            </span>
          )}
        </Group>

      </AppShell.Header>

      {hasNavbar && (
        <AppShell.Navbar p="xs">
          {renderBackLink()}
          {navItems.map(renderNavItem)}
          {extraNavContent?.({ closeMobile })}
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default CommonLayout;
