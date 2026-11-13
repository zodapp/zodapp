import type { CSSProperties } from 'react';
import { Text, Button, Group, Loader, Center, Box, Tooltip } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';

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

type FetchMoreState = 'loading' | 'hasMore' | 'done';

const stackStyle: CSSProperties = { display: 'grid' };
const layerStyle = (visible: boolean): CSSProperties => ({
  gridArea: '1 / 1',
  visibility: visible ? 'visible' : 'hidden',
});

export const FetchMore = ({
  isLoading,
  hasMore,
  fetchMore,
  scannedCount,
  filteredCount,
  itemCount,
  emptyWithMoreMessage = 'フィルタ条件に一致するアイテムが見つかりませんでした',
  emptyNoMoreMessage = 'アイテムがありません。新規作成してください。'
}: FetchMoreProps) => {
  const state: FetchMoreState = isLoading ? 'loading' : hasMore ? 'hasMore' : 'done';

  return (
    <Box mt="md">
      {/*
        3つの状態（読み込み中・さらに読み込む・すべて読み込みました）を同じ場所に重ねて置き、
        いまの状態だけを見せる。枠の高さはいつも一番高い状態に合うので、
        状態が替わっても下の中身が上下に動かない（隠したものは visibility: hidden で、操作もできない）
      */}
      <div style={stackStyle}>
        <Center style={layerStyle(state === 'loading')} aria-hidden={state !== 'loading'}>
          <Tooltip
            label={`${scannedCount}件をスキャン中、${filteredCount}件が条件に一致`}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: 'help' }}>
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                読み込み中...
              </Text>
            </Group>
          </Tooltip>
        </Center>
        <Center style={layerStyle(state === 'hasMore')} aria-hidden={state !== 'hasMore'}>
          <Tooltip
            label={`${scannedCount}件をスキャン済み、${filteredCount}件が条件に一致。続きを読み込めます。`}
            position="bottom"
            withArrow
          >
            <Button
              variant="light"
              color="orange"
              size="sm"
              leftSection={<IconChevronDown size={16} />}
              onClick={fetchMore}
              tabIndex={state === 'hasMore' ? undefined : -1}
            >
              さらに読み込む
            </Button>
          </Tooltip>
        </Center>
        <Center style={layerStyle(state === 'done')} aria-hidden={state !== 'done'}>
          <Tooltip
            label={`全${scannedCount}件をスキャン、${filteredCount}件が条件に一致`}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: 'help' }}>
              <IconCheck size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                すべて読み込みました
              </Text>
            </Group>
          </Tooltip>
        </Center>
      </div>
      {!isLoading && itemCount === 0 && (
        <Text c="dimmed" ta="center" mt="md" size="sm">
          {hasMore ? emptyWithMoreMessage : emptyNoMoreMessage}
        </Text>
      )}
    </Box>
  );
};
