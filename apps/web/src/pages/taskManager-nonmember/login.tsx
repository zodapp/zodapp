import { Navigate, useNavigate } from "@tanstack/react-router";
import {
  Container,
  Paper,
  Text,
  Button,
  Stack,
  Alert,
  Loader,
  Center,
  Image,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

import { useAuthContext } from "../../shared/auth";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

const GoogleIcon = () => (
  <Image src="/google-logo.svg" alt="Google" w={20} h={20} />
);

const LoginPage = () => {
  const { user, loading, error, signInWithGoogle } = useAuthContext();
  const navigate = useNavigate();

  // 認証済みの場合はリダイレクト
  if (user) {
    return <Navigate to={workspacesRoute.to} replace />;
  }

  if (loading) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate({ to: workspacesRoute.to, replace: true });
    } catch {
      // エラーはuseAuthContextで管理される
    }
  };

  return (
    <Container size="xs">
      <Paper radius="md" p="xl" withBorder>
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <Image src="/zodapp-logo.svg" alt="zodapp" h={90} w="auto" />
            <Text c="dimmed" size="sm" ta="center">
              Google アカウントでログインしてください
            </Text>
          </Stack>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="エラー"
              color="red"
              variant="light"
            >
              {error.message}
            </Alert>
          )}

          <Button
            fullWidth
            size="md"
            leftSection={<GoogleIcon />}
            onClick={handleGoogleLogin}
            variant="default"
          >
            Google でログイン
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default LoginPage;
