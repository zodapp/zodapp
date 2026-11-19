import { Modal, Button, Group, Text, Alert } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useDisclosure } from "@mantine/hooks";
import { IconFile, IconUpload, IconX } from "@tabler/icons-react";
import React, { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import {
  csvToTable,
  fromTable,
  toTable,
  type Table as TabularTable,
} from "@zodapp/zod-tabular";
import { TabularPreviewTable } from "./TabularPreviewTable";
import { useMsg } from "../messages/useMsg";

const PREVIEW_LIMIT = 20;
const CSV_DROPZONE_ACCEPT = { "text/csv": [".csv"] };

interface ImportProps<S extends z.ZodType> {
  schema: S;
  onImport: (rows: z.infer<S>[]) => Promise<void> | void;
  validateTable?: (table: TabularTable) => void;
}

function useImportState<S extends z.ZodType>({
  schema,
  onImport,
  validateTable,
}: ImportProps<S>) {
  const msg = useMsg();
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
          setError(
            msg(
              "zodFormWidget.import.csvNoRows" /* CSVにデータ行がありません。 */,
            ),
          );
          return;
        }

        validateTable?.(table);

        const importedRows = fromTable(schema, table);
        if (importedRows.length === 0) {
          setRows([]);
          setPreviewTable(table.slice(0, 1));
          setError(
            msg(
              "zodFormWidget.import.csvNothingToImport" /* CSVから取り込めるデータがありません。 */,
            ),
          );
          return;
        }

        setRows(importedRows);
        setPreviewTable(toTable(schema, importedRows.slice(0, PREVIEW_LIMIT)));
      } catch (e) {
        setRows([]);
        setPreviewTable([]);
        console.error("CSV import parse failed", e);
        setError(
          msg(
            "zodFormWidget.import.csvParseError" /* CSV解析エラー: ${message} */,
            {
              message:
                e instanceof Error
                  ? msg.resolve(e.message)
                  : String(e) ||
                    msg(
                      "zodFormWidget.import.csvParseFailed" /* CSVの解析に失敗しました。 */,
                    ),
            },
          ),
        );
      }
    },
    [msg, schema, validateTable],
  );

  const handleRejectFile = useCallback(() => {
    setRows([]);
    setPreviewTable([]);
    setFilename(null);
    setError(
      msg(
        "zodFormWidget.import.csvSelectFile" /* CSVファイルを選択してください。 */,
      ),
    );
  }, [msg]);

  const executeImport = useCallback(async () => {
    if (rows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      await onImport(rows);
      reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? msg(
              "zodFormWidget.import.importError" /* インポートエラー: ${message} */,
              {
                message: msg.resolve(e.message),
              },
            )
          : msg(
              "zodFormWidget.import.importFailed" /* インポートに失敗しました。 */,
            ),
      );
    } finally {
      setIsImporting(false);
    }
  }, [rows, onImport, reset, msg]);

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
    handleRejectFile,
    executeImport,
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
  submitLabel,
  renderFooter,
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
    handleRejectFile,
    executeImport,
  } = state;
  const msg = useMsg();

  return (
    <>
      <Text size="sm" c="dimmed" mb="sm">
        {msg(
          "zodFormWidget.import.csvDescription" /* CSVファイルを選択して内容を確認後に取り込みます。 */,
        )}
      </Text>

      <Dropzone
        onDrop={(files) => {
          void handleSelectFile(files[0] ?? null);
        }}
        onReject={handleRejectFile}
        accept={CSV_DROPZONE_ACCEPT}
        multiple={false}
        loading={isImporting}
        disabled={isImporting}
        mb="sm"
      >
        <Group
          justify="center"
          gap="xl"
          mih={180}
          style={{ pointerEvents: "none" }}
        >
          <Dropzone.Accept>
            <IconUpload
              size={52}
              color="var(--mantine-color-blue-6)"
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile
              size={52}
              color="var(--mantine-color-dimmed)"
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="lg" inline>
              {msg(
                "zodFormWidget.import.csvDropzone" /* ここにCSVファイルをドラッグ、またはクリックして選択 */,
              )}
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              {msg(
                "zodFormWidget.import.csvDropzoneHint" /* CSV形式のファイルを1つ選択してください */,
              )}
            </Text>
          </div>
        </Group>
      </Dropzone>

      {filename && (
        <Text size="sm" mb="sm">
          {msg("zodFormWidget.import.selected" /* 選択中: ${name} */, {
            name: filename,
          })}
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
            {rows.length <= PREVIEW_LIMIT
              ? msg(
                  "zodFormWidget.import.plannedAll" /* ${count} 件を取り込み予定です（全${count}件を表示中）。 */,
                  { count: rows.length },
                )
              : msg(
                  "zodFormWidget.import.plannedHead" /* ${count} 件を取り込み予定です（先頭 ${limit} 件を表示）。 */,
                  { count: rows.length, limit: PREVIEW_LIMIT },
                )}
          </Text>
          <TabularPreviewTable headers={previewHeaders} rows={previewRows} />
        </>
      ) : (
        <Text size="sm" c="dimmed" mb="md">
          {msg(
            "zodFormWidget.import.csvEmpty" /* まだCSVが選択されていません。 */,
          )}
        </Text>
      )}

      {renderFooter ? (
        renderFooter({ executeImport, isImporting, rowCount: rows.length })
      ) : (
        <Group justify="flex-end">
          {showCancel && onCancel && (
            <Button variant="default" onClick={onCancel}>
              {msg("zodFormWidget.common.cancel" /* キャンセル */)}
            </Button>
          )}
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={executeImport}
            loading={isImporting}
            disabled={rows.length === 0}
          >
            {submitLabel ??
              msg("zodFormWidget.import.csvSubmit" /* CSVをインポート */)}
          </Button>
        </Group>
      )}
    </>
  );
}

export function useImportModal<S extends z.ZodType>({
  title: titleFromProps,
  ...props
}: ImportProps<S> & {
  /** モーダルのタイトル。文字のほかに部品（ガイドを開くボタンなど）も置ける */
  title?: React.ReactNode;
}) {
  const msg = useMsg();
  const title =
    titleFromProps ?? msg("zodFormWidget.import.title" /* データインポート */);
  const [opened, { open, close }] = useDisclosure(false);
  const state = useImportState(props);
  const { reset } = state;

  const handleClose = useCallback(() => {
    close();
    reset();
  }, [close, reset]);

  const modal = (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title}
      size="calc(100vw - 3rem)"
    >
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

  return (
    <ImportContent
      state={state}
      submitLabel={submitLabel}
      renderFooter={renderFooter}
    />
  );
}
