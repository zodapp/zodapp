import { Alert, Button, Group, Text } from "@mantine/core";
import { useMsg } from "../messages/useMsg";

/**
 * 選択肢などの取得に失敗したときの表示。再試行のボタンを出す。
 * zod-form-mantine の dynamic の失敗の表示と同じ見た目・文言にする
 */
export const FetchErrorView = ({
  label,
  retry,
}: {
  label: string | undefined;
  retry: () => void;
}) => {
  const msg = useMsg();
  return (
    <Alert color="red" data-dynamic-status="error">
      <Group justify="space-between">
        <Text size="sm">
          {label
            ? msg(
                "zodFormMantineLite.fetchFailedWithLabel" /* i18n: ${label}を取得できませんでした */,
                { label },
              )
            : msg(
                "zodFormMantineLite.fetchFailed" /* i18n: 取得できませんでした */,
              )}
        </Text>
        <Button size="xs" variant="light" onClick={retry}>
          {msg("zodFormMantineLite.retry" /* i18n: 再試行 */)}
        </Button>
      </Group>
    </Alert>
  );
};
