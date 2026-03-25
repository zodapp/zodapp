import { Modal, Button, Group, Text, Alert, FileButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUpload } from '@tabler/icons-react';
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { csvToTable, fromTable, toTable, type Table as TabularTable } from '@zodapp/zod-tabular';
import { TabularPreviewTable } from './TabularPreviewTable';

const PREVIEW_LIMIT = 20;

interface ImportProps<S extends z.ZodType> {
  schema: S;
  onImport: (rows: z.infer<S>[]) => Promise<void> | void;
  validateTable?: (table: TabularTable) => void;
}

function useImportState<S extends z.ZodType>({ schema, onImport, validateTable }: ImportProps<S>) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<z.infer<S>[]>([]);
  const [previewTable, setPreviewTable] = useState<TabularTable>([]);

  const reset = useCallback(() => {
    setError(null);
    setFilename(null);
    setRows([]);
    setPreviewTable([]);
  }, []);

  const handleSelectFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setFilename(file.name);

      try {
        const csv = await file.text();
        const table = csvToTable(csv);
        if (table.length < 2) {
          setRows([]);
          setPreviewTable(table.slice(0, 1));
          setError('CSVにデータ行がありません。');
          return;
        }

        validateTable?.(table);

        const importedRows = fromTable(schema, table);
        if (importedRows.length === 0) {
          setRows([]);
          setPreviewTable(table.slice(0, 1));
          setError('CSVから取り込めるデータがありません。');
          return;
        }

        setRows(importedRows);
        setPreviewTable(toTable(schema, importedRows.slice(0, PREVIEW_LIMIT)));
      } catch (e) {
        setRows([]);
        setPreviewTable([]);
        setError(e instanceof Error ? `CSV解析エラー: ${e.message}` : 'CSVの解析に失敗しました。');
      }
    },
    [schema, validateTable]
  );

  const executeImport = useCallback(async () => {
    if (rows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      await onImport(rows);
      reset();
    } catch (e) {
      setError(
        e instanceof Error ? `インポートエラー: ${e.message}` : 'インポートに失敗しました。'
      );
    } finally {
      setIsImporting(false);
    }
  }, [rows, onImport, reset]);

  const previewRows = useMemo(() => previewTable.slice(1), [previewTable]);
  const previewHeaders = previewTable[0] ?? [];

  return {
    isImporting,
    error,
    filename,
    rows,
    previewRows,
    previewHeaders,
    reset,
    handleSelectFile,
    executeImport
  };
}

export type ImportPanelRenderProps = {
  executeImport: () => Promise<void>;
  isImporting: boolean;
  rowCount: number;
};

function ImportContent<S extends z.ZodType>({
  state,
  showCancel,
  onCancel,
  submitLabel = 'CSVをインポート',
  renderFooter
}: {
  state: ReturnType<typeof useImportState<S>>;
  showCancel?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  renderFooter?: (props: ImportPanelRenderProps) => React.ReactNode;
}) {
  const {
    isImporting,
    error,
    filename,
    rows,
    previewRows,
    previewHeaders,
    handleSelectFile,
    executeImport
  } = state;

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dimmed">
          CSVファイルを選択して内容を確認後に取り込みます。
        </Text>
        <FileButton onChange={handleSelectFile} accept=".csv,text/csv">
          {(props) => (
            <Button {...props} leftSection={<IconUpload size={16} />} variant="default">
              CSVを選択
            </Button>
          )}
        </FileButton>
      </Group>

      {filename && (
        <Text size="sm" mb="sm">
          選択中: {filename}
        </Text>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {rows.length > 0 ? (
        <>
          <Text size="sm" mb="xs">
            {rows.length} 件を取り込み予定です（
            {rows.length <= PREVIEW_LIMIT
              ? `全${rows.length}件を表示中`
              : `先頭 ${PREVIEW_LIMIT} 件を表示`}
            ）。
          </Text>
          <TabularPreviewTable headers={previewHeaders} rows={previewRows} />
        </>
      ) : (
        <Text size="sm" c="dimmed" mb="md">
          まだCSVが選択されていません。
        </Text>
      )}

      {renderFooter ? (
        renderFooter({ executeImport, isImporting, rowCount: rows.length })
      ) : (
        <Group justify="flex-end">
          {showCancel && onCancel && (
            <Button variant="default" onClick={onCancel}>
              キャンセル
            </Button>
          )}
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={executeImport}
            loading={isImporting}
            disabled={rows.length === 0}
          >
            {submitLabel}
          </Button>
        </Group>
      )}
    </>
  );
}

export function useImportModal<S extends z.ZodType>(props: ImportProps<S>) {
  const [opened, { open, close }] = useDisclosure(false);
  const state = useImportState(props);

  const handleClose = useCallback(() => {
    close();
    state.reset();
  }, [close, state.reset]);

  const modal = (
    <Modal opened={opened} onClose={handleClose} title="データインポート" size="calc(100vw - 3rem)">
      <ImportContent state={state} showCancel onCancel={handleClose} />
    </Modal>
  );

  return { open, modal };
}

interface ImportPanelProps<S extends z.ZodType> extends ImportProps<S> {
  submitLabel?: string;
  renderFooter?: (props: ImportPanelRenderProps) => React.ReactNode;
}

export function ImportPanel<S extends z.ZodType>({
  submitLabel,
  renderFooter,
  ...props
}: ImportPanelProps<S>) {
  const state = useImportState(props);

  return <ImportContent state={state} submitLabel={submitLabel} renderFooter={renderFooter} />;
}
