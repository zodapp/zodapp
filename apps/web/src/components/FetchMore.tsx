import {
  Text,
  Button,
  Group,
  Loader,
  Center,
  Box,
  Tooltip,
} from "@mantine/core";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";

export interface FetchMoreProps {
  /** ローディング中かどうか */
  isLoading: boolean;
  /** さらに読み込めるかどうか */
  hasMore: boolean;
  /** さらに読み込む関数 */
  fetchMore: () => void;
  /** スキャンした件数 */
  scannedCount: number;
  /** フィルタに一致した件数 */
  filteredCount: number;
  /** 現在のアイテム数 */
  itemCount: number;
  /** アイテムがなく、まだ読み込める場合のメッセージ */
  emptyWithMoreMessage?: string;
  /** アイテムがなく、すべて読み込み済みの場合のメッセージ */
  emptyNoMoreMessage?: string;
}

export const FetchMore = ({
  isLoading,
  hasMore,
  fetchMore,
  scannedCount,
  filteredCount,
  itemCount,
  emptyWithMoreMessage = "フィルタ条件に一致するアイテムが見つかりませんでした",
  emptyNoMoreMessage = "アイテムがありません。新規作成してください。",
}: FetchMoreProps) => {
  return (
    <Box mt="md">
      <Center>
        {isLoading ? (
          <Tooltip
            label={`${scannedCount}件をスキャン中、${filteredCount}件が条件に一致`}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: "help" }}>
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                読み込み中...
              </Text>
            </Group>
          </Tooltip>
        ) : hasMore ? (
          <Tooltip
            label={`${scannedCount}件をスキャン済み、${filteredCount}件が条件に一致。続きを読み込めます。`}
            position="bottom"
            withArrow
          >
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconChevronDown size={16} />}
              onClick={fetchMore}
            >
              さらに読み込む
            </Button>
          </Tooltip>
        ) : (
          <Tooltip
            label={`全${scannedCount}件をスキャン、${filteredCount}件が条件に一致`}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: "help" }}>
              <IconCheck size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                すべて読み込みました
              </Text>
            </Group>
          </Tooltip>
        )}
      </Center>
      {!isLoading && itemCount === 0 && (
        <Text c="dimmed" ta="center" mt="md" size="sm">
          {hasMore ? emptyWithMoreMessage : emptyNoMoreMessage}
        </Text>
      )}
    </Box>
  );
};
