import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Alert,
  Anchor,
} from "@mantine/core";
import { IconAlertCircle, IconMailCheck } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

import { useAuthContext } from "../../shared/auth";
import { loginRoute } from "./login.route";
import { AutoForm } from "../../components/AutoForm";

const passwordResetSchema = z
  .object({
    email: zf
      .string()
      .min(1, "メールアドレスを入力してください")
      .register(zf.string.registry, {
        label: "メールアドレス",
        uiType: "email",
      }),
  })
  .register(zf.object.registry, {});

const PasswordResetPage = () => {
  const { error, sendPasswordReset } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (data: z.infer<typeof passwordResetSchema>) => {
    setIsSubmitting(true);
    try {
      await sendPasswordReset(data.email);
      setSentTo(data.email);
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
            <Title order={2}>パスワードリセット</Title>
            <Text c="dimmed" size="sm" ta="center">
              登録済みのメールアドレスにパスワード再設定用のリンクを送信します
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

          {sentTo ? (
            <Alert
              icon={<IconMailCheck size={16} />}
              title="送信しました"
              color="green"
              variant="light"
            >
              <Text size="sm">
                {sentTo} 宛にパスワード再設定用のメールを送信しました。
                メール内のリンクから再設定してください。
              </Text>
            </Alert>
          ) : (
            <AutoForm
              schema={passwordResetSchema}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              submitLabel="送信する"
            />
          )}

          <Anchor component={Link} to={loginRoute.to} size="sm" ta="center">
            ログイン画面に戻る
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  );
};

export default PasswordResetPage;
