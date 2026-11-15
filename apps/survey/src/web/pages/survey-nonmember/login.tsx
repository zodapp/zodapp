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
  SegmentedControl,
  Anchor,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useState } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

import { useAuthContext } from "../../shared/auth";
import { workspacesRoute } from "../survey-top/workspaces.route";
import { passwordResetRoute } from "./passwordReset.route";
import { AutoForm } from "../../components/AutoForm";
import { fullWidthSubmitAction } from "../../components/fullWidthSubmitAction";

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

// Cognito はサインアップの後、メールで届く確認コードの入力を求める
const confirmSchema = z
  .object({
    code: zf
      .string()
      .min(1, "確認コードを入力してください")
      .register(zf.string.registry, { label: "確認コード" }),
  })
  .register(zf.object.registry, {});

type AuthMode = "signIn" | "signUp";

const LoginPage = () => {
  const { user, loading, error, signInWithEmail, signUpWithEmail, confirmSignUpWithCode } =
    useAuthContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 確認コードの入力待ち（サインアップの入力を覚えておき、確認の後にログインする）
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);

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
      const { needsConfirmation } = await signUpWithEmail(
        data.email,
        data.password,
        data.displayName,
      );
      if (needsConfirmation) {
        setPending({ email: data.email, password: data.password });
      } else {
        await signInWithEmail(data.email, data.password);
        navigate({ to: workspacesRoute.to, replace: true });
      }
    } catch {
      // エラーはuseAuthContextで管理される
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (data: z.infer<typeof confirmSchema>) => {
    if (!pending) return;
    setIsSubmitting(true);
    try {
      await confirmSignUpWithCode(pending.email, data.code);
      await signInWithEmail(pending.email, pending.password);
      navigate({ to: workspacesRoute.to, replace: true });
    } catch {
      // エラーはuseAuthContextで管理される
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container size="xs" w="100%">
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

          {pending ? (
            <Stack gap="sm">
              <Text size="sm">
                {pending.email} 宛に確認コードを送信しました。メールに書かれたコードを入力してください。
              </Text>
              <AutoForm
                key="confirm"
                schema={confirmSchema}
                isLoading={isSubmitting}
                actionsPosition="bottom"
                actions={[fullWidthSubmitAction<typeof confirmSchema>("確認してログイン", handleConfirm)]}
              />
              <Button variant="subtle" onClick={() => setPending(null)}>
                戻る
              </Button>
            </Stack>
          ) : (
          <>
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
              isLoading={isSubmitting}
              actionsPosition="bottom"
              actions={[fullWidthSubmitAction<typeof signInSchema>("ログイン", handleSignIn)]}
            />
          ) : (
            <AutoForm
              key="signUp"
              schema={signUpSchema}
              isLoading={isSubmitting}
              actionsPosition="bottom"
              actions={[fullWidthSubmitAction<typeof signUpSchema>("登録する", handleSignUp)]}
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
          </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
};

export default LoginPage;
