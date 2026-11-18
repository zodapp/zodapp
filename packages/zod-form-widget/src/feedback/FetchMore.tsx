import type { CSSProperties } from 'react';
import { Text, Button, Group, Loader, Center, Box, Tooltip } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { useMsg } from '../messages/useMsg';

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
  emptyWithMoreMessage,
  emptyNoMoreMessage
}: FetchMoreProps) => {
  const msg = useMsg();
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
            label={msg(
              'zodFormWidget.fetchMore.loadingTooltip' /* ${scanned}件をスキャン中、${filtered}件が条件に一致 */,
              { scanned: scannedCount, filtered: filteredCount }
            )}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: 'help' }}>
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                {msg('zodFormWidget.fetchMore.loading' /* 読み込み中... */)}
              </Text>
            </Group>
          </Tooltip>
        </Center>
        <Center style={layerStyle(state === 'hasMore')} aria-hidden={state !== 'hasMore'}>
          <Tooltip
            label={msg(
              'zodFormWidget.fetchMore.hasMoreTooltip' /* ${scanned}件をスキャン済み、${filtered}件が条件に一致。続きを読み込めます。 */,
              { scanned: scannedCount, filtered: filteredCount }
            )}
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
              {msg('zodFormWidget.fetchMore.loadMore' /* さらに読み込む */)}
            </Button>
          </Tooltip>
        </Center>
        <Center style={layerStyle(state === 'done')} aria-hidden={state !== 'done'}>
          <Tooltip
            label={msg(
              'zodFormWidget.fetchMore.doneTooltip' /* 全${scanned}件をスキャン、${filtered}件が条件に一致 */,
              { scanned: scannedCount, filtered: filteredCount }
            )}
            position="bottom"
            withArrow
          >
            <Group gap="xs" style={{ cursor: 'help' }}>
              <IconCheck size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {msg('zodFormWidget.fetchMore.done' /* すべて読み込みました */)}
              </Text>
            </Group>
          </Tooltip>
        </Center>
      </div>
      {!isLoading && itemCount === 0 && (
        <Text c="dimmed" ta="center" mt="md" size="sm">
          {hasMore
            ? (emptyWithMoreMessage ??
              msg(
                'zodFormWidget.fetchMore.emptyWithMore' /* フィルタ条件に一致するアイテムが見つかりませんでした */
              ))
            : (emptyNoMoreMessage ??
              msg(
                'zodFormWidget.fetchMore.emptyNoMore' /* アイテムがありません。新規作成してください。 */
              ))}
        </Text>
      )}
    </Box>
  );
};
