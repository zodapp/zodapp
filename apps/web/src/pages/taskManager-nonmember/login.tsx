import { Navigate, useNavigate, Link } from "@tanstack/react-router";
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
  Divider,
  SegmentedControl,
  Anchor,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

import { useAuthContext } from "../../shared/auth";
import { workspacesRoute } from "../taskManager-top/workspaces.route";
import { passwordResetRoute } from "./passwordReset.route";
import { AutoForm } from "../../components/AutoForm";

const GoogleIcon = () => (
  <Image src="/google-logo.svg" alt="Google" w={20} h={20} />
);

// ログイン/新規登録フォームも zf スキーマ + AutoForm で組める
const signInSchema = z
  .object({
    email: zf
      .string()
      .min(1, "メールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス",
        uiType: "email",
      }),
    password: zf
      .string()
      .min(6, "6文字以上で入力してください")
      .register(zf.string.registry, {
        label: "パスワード",
        uiType: "password",
      }),
  })
  .register(zf.object.registry, {});

const signUpSchema = z
  .object({
    displayName: zf
      .string()
      .min(1, "表示名を入力してください")
      .register(zf.string.registry, { label: "表示名" }),
    email: zf
      .string()
      .min(1, "メールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス",
        uiType: "email",
      }),
    password: zf
      .string()
      .min(6, "6文字以上で入力してください")
      .register(zf.string.registry, {
        label: "パスワード",
        uiType: "password",
      }),
  })
  .register(zf.object.registry, {});

type AuthMode = "signIn" | "signUp";

const LoginPage = () => {
  const { user, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuthContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSignIn = async (data: z.infer<typeof signInSchema>) => {
    setIsSubmitting(true);
    try {
      await signInWithEmail(data.email, data.password);
      navigate({ to: workspacesRoute.to, replace: true });
    } catch {
      // エラーはuseAuthContextで管理される
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (data: z.infer<typeof signUpSchema>) => {
    setIsSubmitting(true);
    try {
      await signUpWithEmail(data.email, data.password, data.displayName);
      navigate({ to: workspacesRoute.to, replace: true });
    } catch {
      // エラーはuseAuthContextで管理される
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container size="xs">
      <Paper radius="md" p="xl" withBorder>
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <Image src="/zodapp-logo.svg" alt="zodapp" h={90} w="auto" />
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

          <Divider label="またはメールアドレスで" labelPosition="center" />

          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(value) => setMode(value as AuthMode)}
            data={[
              { value: "signIn", label: "ログイン" },
              { value: "signUp", label: "新規登録" },
            ]}
          />

          {mode === "signIn" ? (
            <AutoForm
              key="signIn"
              schema={signInSchema}
              onSubmit={handleSignIn}
              isLoading={isSubmitting}
              submitLabel="ログイン"
            />
          ) : (
            <AutoForm
              key="signUp"
              schema={signUpSchema}
              onSubmit={handleSignUp}
              isLoading={isSubmitting}
              submitLabel="登録する"
            />
          )}

          <Anchor
            component={Link}
            to={passwordResetRoute.to}
            size="sm"
            ta="center"
          >
            パスワードをお忘れですか？
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  );
};

export default LoginPage;
