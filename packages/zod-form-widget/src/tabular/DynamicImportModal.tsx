import { Modal, Button, Group, Text, Alert, FileButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUpload } from '@tabler/icons-react';
import React, { useCallback, useMemo, useState } from 'react';
import type { Table } from '@zodapp/zod-tabular';
import {
  buildDynamicTabularPreviewRows,
  parseDynamicTabularFile,
  type DynamicTabularParseResult,
  type DynamicTabularRow
} from './dynamicTabular';
import { TabularPreviewTable } from './TabularPreviewTable';

const PREVIEW_LIMIT = 20;

export type DynamicImportValue = {
  file: File;
  fileName: string;
  parsed: DynamicTabularParseResult;
  previewRows: DynamicTabularRow[];
};

interface DynamicImportProps {
  value?: DynamicImportValue | null;
  onImport?: (value: DynamicImportValue) => Promise<void> | void;
  onChange?: (value: DynamicImportValue | null) => void;
  onError?: (message: string | null) => void;
  validateParsed?: (parsed: DynamicTabularParseResult) => void;
  accept?: string;
  emptyStateText?: string;
}

function toPreviewTableRows(headers: string[], rows: DynamicTabularRow[]): Table {
  return rows.map((row) => headers.map((header) => row[header] ?? null));
}

function useDynamicImportState({
  value: controlledValue,
  onImport,
  onChange,
  onError,
  validateParsed,
  accept
}: DynamicImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalValue, setInternalValue] = useState<DynamicImportValue | null>(null);
  const acceptedFileTypes = accept ?? '.csv,text/csv';
  const value = controlledValue ?? internalValue;

  const reset = useCallback(() => {
    setError(null);
    setInternalValue(null);
    onChange?.(null);
    onError?.(null);
  }, [onChange, onError]);

  const handleSelectFile = useCallback(
    async (file: File | null) => {
      if (!file) return;

      setError(null);
      onError?.(null);
      try {
        const parsed = await parseDynamicTabularFile(file);
        validateParsed?.(parsed);
        const nextValue: DynamicImportValue = {
          file,
          fileName: file.name,
          parsed,
          previewRows: buildDynamicTabularPreviewRows(parsed.rows, PREVIEW_LIMIT)
        };
        setInternalValue(nextValue);
        onChange?.(nextValue);
      } catch (e) {
        setInternalValue(null);
        onChange?.(null);
        const message =
          e instanceof Error ? `解析エラー: ${e.message}` : 'ファイルの解析に失敗しました。';
        setError(message);
        onError?.(message);
      }
    },
    [onChange, onError, validateParsed]
  );

  const executeImport = useCallback(async () => {
    if (!value || !onImport) return;
    setIsImporting(true);
    setError(null);
    try {
      await onImport(value);
      reset();
    } catch (e) {
      const message =
        e instanceof Error ? `インポートエラー: ${e.message}` : 'インポートに失敗しました。';
      setError(message);
      onError?.(message);
    } finally {
      setIsImporting(false);
    }
  }, [onError, onImport, reset, value]);

  const previewHeaders = value?.parsed.headers ?? [];
  const previewTableRows = useMemo(
    () => toPreviewTableRows(previewHeaders, value?.previewRows ?? []),
    [previewHeaders, value]
  );

  return {
    acceptedFileTypes,
    error,
    isImporting,
    previewHeaders,
    previewTableRows,
    reset,
    canImport: Boolean(onImport),
    value,
    handleSelectFile,
    executeImport
  };
}

export type DynamicImportPanelRenderProps = {
  executeImport: () => Promise<void>;
  isImporting: boolean;
  rowCount: number;
  value: DynamicImportValue | null;
};

function DynamicImportContent({
  state,
  showCancel,
  onCancel,
  submitLabel = 'データをインポート',
  emptyStateText = 'まだファイルが選択されていません。',
  renderFooter
}: {
  state: ReturnType<typeof useDynamicImportState>;
  showCancel?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  emptyStateText?: string;
  renderFooter?: (props: DynamicImportPanelRenderProps) => React.ReactNode;
}) {
  const {
    acceptedFileTypes,
    error,
    isImporting,
    previewHeaders,
    previewTableRows,
    value,
    handleSelectFile,
    executeImport
  } = state;
  const rowCount = value?.parsed.rows.length ?? 0;

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dimmed">
          ファイルを選択して内容を確認後に取り込みます。
        </Text>
        <FileButton onChange={handleSelectFile} accept={acceptedFileTypes}>
          {(props) => (
            <Button {...props} leftSection={<IconUpload size={16} />} variant="default">
              ファイルを選択
            </Button>
          )}
        </FileButton>
      </Group>

      {value && (
        <Text size="sm" mb="sm">
          選択中: {value.fileName}
        </Text>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {value ? (
        <>
          <Text size="sm" mb="xs">
            {rowCount} 件を取り込み予定です（
            {rowCount <= PREVIEW_LIMIT
              ? `全${rowCount}件を表示中`
              : `先頭 ${PREVIEW_LIMIT} 件を表示`}
            ）。
          </Text>
          <TabularPreviewTable headers={previewHeaders} rows={previewTableRows} />
        </>
      ) : (
        <Text size="sm" c="dimmed" mb="md">
          {emptyStateText}
        </Text>
      )}

      {renderFooter ? (
        renderFooter({ executeImport, isImporting, rowCount, value })
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
            disabled={!value || !state.canImport}
          >
            {submitLabel}
          </Button>
        </Group>
      )}
    </>
  );
}

export function useDynamicImportModal(props: DynamicImportProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const state = useDynamicImportState(props);

  const handleClose = useCallback(() => {
    close();
    state.reset();
  }, [close, state.reset]);

  const modal = (
    <Modal opened={opened} onClose={handleClose} title="データインポート" size="calc(100vw - 3rem)">
      <DynamicImportContent state={state} showCancel onCancel={handleClose} />
    </Modal>
  );

  return { open, modal };
}

interface DynamicImportPanelProps extends DynamicImportProps {
  submitLabel?: string;
  renderFooter?: (props: DynamicImportPanelRenderProps) => React.ReactNode;
}

export function DynamicImportPanel({
  submitLabel,
  renderFooter,
  emptyStateText,
  ...props
}: DynamicImportPanelProps) {
  const state = useDynamicImportState(props);

  return (
    <DynamicImportContent
      state={state}
      submitLabel={submitLabel}
      emptyStateText={emptyStateText}
      renderFooter={renderFooter}
    />
  );
}
