import { Modal, Button, Group, Text, Alert } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDownload } from '@tabler/icons-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { toTable, tableToCsv } from '@zodapp/zod-tabular';
import { TabularPreviewTable } from './TabularPreviewTable';
import { useMsg } from '../messages/useMsg';
import { tabularOptions } from './skipDynamic';

interface ExportModalProps<S extends z.ZodType> {
  schema: S;
  data: z.infer<S>[];
  fetchAll: () => Promise<z.infer<S>[]>;
  filename?: string;
  /** モーダルのタイトル。文字のほかに部品（ガイドを開くボタンなど）も置ける */
  title?: ReactNode;
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PREVIEW_LIMIT = 20;

export function useExportModal<S extends z.ZodType>({
  schema,
  data,
  fetchAll,
  filename = 'export.csv',
  title: titleFromProps
}: ExportModalProps<S>) {
  const msg = useMsg();
  const title = titleFromProps ?? msg('zodFormWidget.export.title' /* i18n: データエクスポート */);
  const [opened, { open, close }] = useDisclosure(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewData = useMemo(() => data.slice(0, PREVIEW_LIMIT), [data]);
  const previewTable = useMemo(() => {
    if (!opened || previewData.length === 0) return null;
    return toTable(schema, previewData, tabularOptions);
  }, [opened, schema, previewData]);

  const handleDownload = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const allData = await fetchAll();
      if (allData.length === 0) {
        setError(msg('zodFormWidget.export.noData' /* i18n: エクスポート対象のデータがありません。 */));
        return;
      }
      const table = toTable(schema, allData, tabularOptions);
      const csv = tableToCsv(table);
      downloadCsv(csv, filename);
      close();
    } catch (e) {
      setError(
        e instanceof Error
          ? msg('zodFormWidget.export.fetchError' /* i18n: 取得エラー: ${message} */, {
              message: msg.resolve(e.message)
            })
          : msg('zodFormWidget.export.fetchFailed' /* i18n: データの取得に失敗しました。 */)
      );
    } finally {
      setIsFetching(false);
    }
  }, [fetchAll, schema, filename, close, msg]);

  const modal = (
    <Modal opened={opened} onClose={close} title={title} size="calc(100vw - 3rem)">
      {data.length === 0 ? (
        <Text c="dimmed">
          {msg('zodFormWidget.export.nothingShown' /* i18n: 現在表示中のデータがありません。 */)}
        </Text>
      ) : (
        <>
          <Group justify="flex-end" mb="sm">
            <Button variant="default" onClick={close}>
              {msg('zodFormWidget.common.cancel' /* i18n: キャンセル */)}
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleDownload}
              loading={isFetching}
            >
              {msg('zodFormWidget.export.download' /* i18n: 全件取得してCSVダウンロード */)}
            </Button>
          </Group>

          {error && (
            <Alert color="red" mb="md">
              {error}
            </Alert>
          )}

          <Text size="sm" mb="xs">
            {msg('zodFormWidget.export.preview' /* i18n: 先頭 ${count} 件をプレビュー表示しています。 */, {
              count: previewData.length
            })}
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            {msg(
              'zodFormWidget.export.downloadNote' /* i18n: ダウンロード時は全件を取得してエクスポートします。 */
            )}
          </Text>

          {previewTable && (
            <TabularPreviewTable headers={previewTable[0] ?? []} rows={previewTable.slice(1)} />
          )}
        </>
      )}
    </Modal>
  );

  return { open, modal };
}
