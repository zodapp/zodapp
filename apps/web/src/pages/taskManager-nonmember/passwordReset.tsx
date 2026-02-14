import { Container, Paper, Title, Text, Stack, Alert } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

const PasswordResetPage = () => {
  return (
    <Container size="xs">
      <Paper radius="md" p="xl" withBorder>
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <Title order={2}>パスワードリセット</Title>
          </Stack>

          <Alert
            icon={<IconInfoCircle size={16} />}
            title="お知らせ"
            color="blue"
            variant="light"
          >
            <Text size="sm">
              この機能は現在利用できません。
            </Text>
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
};

export default PasswordResetPage;
