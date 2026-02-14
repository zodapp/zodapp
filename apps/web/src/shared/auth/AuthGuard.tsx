import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { Center, Loader } from "@mantine/core";

import { useAuthContext } from "./AuthProvider";
import { loginRoute } from "../../pages/taskManager-nonmember/login.route";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to={loginRoute.to} replace />;
  }

  return <>{children}</>;
}
