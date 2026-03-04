import {
  Modal,
  Button,
  Group,
  Text,
  Table,
  ScrollArea,
  Alert,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone } from "@mantine/dropzone";
import { IconUpload, IconFileTypeCsv, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  fromTable,
  csvToTable,
  toTable,
  formatCell,
  type FromTableOptions,
  type Table as TabularTable,
} from "@zodapp/zod-tabular";

const PREVIEW_LIMIT = 20;

const CSV_CONVERTER: FromTableOptions = {
  booleanConverter: (v) => {
    if (typeof v === "string") {
      const s = v.trim().toUpperCase();
      if (s === "TRUE" || s === "1") return true;
      if (s === "FALSE" || s === "0") return false;
    }
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : undefined;
    return undefined;
  },
  dateConverter: (v) => {
    if (typeof v === "string") {
      const s = v.trim();
      if (s === "") return undefined;
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  },
};

interface ImportModalProps<S extends z.ZodType> {
  schema: S;
  onImport: (rows: z.infer<S>[]) => Promise<void>;
}

export function useImportModal<S extends z.ZodType>({
  schema,
  onImport,
}: ImportModalProps<S>) {
  const [opened, { open, close }] = useDisclosure(false);
  const [parsedTable, setParsedTable] = useState<TabularTable | null>(null);
  const [parsedRows, setParsedRows] = useState<z.infer<S>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setParsedTable(null);
      setParsedRows(null);

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const csv = reader.result as string;
          const table = csvToTable(csv);
          if (table.length < 2) {
            setError("ヘッダ行のみ、またはデータが空です。");
            return;
          }
          const rows = fromTable(schema, table, CSV_CONVERTER);
          if (rows.length === 0) {
            setError("CSVから取り込めるデータがありません。");
            return;
          }
          setParsedRows(rows);
          setParsedTable(toTable(schema, rows.slice(0, PREVIEW_LIMIT)));
        } catch (e) {
          setError(
            e instanceof Error
              ? `パースエラー: ${e.message}`
              : "CSVの読み込みに失敗しました。",
          );
        }
      };
      reader.readAsText(file);
    },
    [schema],
  );

  const handleImport = useCallback(async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parsedRows);
      setParsedTable(null);
      setParsedRows(null);
      setError(null);
      close();
    } catch (e) {
      setError(
        e instanceof Error
          ? `インポートエラー: ${e.message}`
          : "インポートに失敗しました。",
      );
    } finally {
      setIsImporting(false);
    }
  }, [parsedRows, onImport, close]);

  const handleClose = useCallback(() => {
    setParsedTable(null);
    setParsedRows(null);
    setError(null);
    close();
  }, [close]);

  const modal = (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="データインポート"
      size="calc(100vw - 3rem)"
    >
      {!parsedTable ? (
        <>
          <Dropzone
            onDrop={handleDrop}
            accept={["text/csv", "application/vnd.ms-excel"]}
            maxFiles={1}
            mb="md"
          >
            <Group
              justify="center"
              gap="xl"
              mih={120}
              style={{ pointerEvents: "none" }}
            >
              <Dropzone.Accept>
                <IconUpload size={40} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={40} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFileTypeCsv size={40} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="lg" inline>
                  CSVファイルをドラッグ&ドロップ
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  またはクリックしてファイルを選択
                </Text>
              </div>
            </Group>
          </Dropzone>

          {error && (
            <Alert color="red" mb="md">
              {error}
            </Alert>
          )}
        </>
      ) : (
        <>
          {(() => {
            const totalRows = parsedRows?.length ?? 0;
            const previewRows = parsedTable.slice(1);
            const previewCount = previewRows.length;
            return (
              <>
                <Group justify="flex-end" mb="sm">
                  <Button variant="default" onClick={handleClose}>
                    キャンセル
                  </Button>
                  <Button
                    leftSection={<IconUpload size={16} />}
                    onClick={handleImport}
                    loading={isImporting}
                    disabled={!parsedRows || parsedRows.length === 0}
                  >
                    {totalRows} 件をインポート
                  </Button>
                </Group>

                {error && (
                  <Alert color="red" mb="md">
                    {error}
                  </Alert>
                )}

                <Text size="sm" mb="sm">
                  {totalRows} 件を取り込み予定です（
                  {totalRows <= PREVIEW_LIMIT
                    ? `全${totalRows}件を表示中`
                    : `先頭 ${previewCount} 件を表示`}
                  ）。
                </Text>

                <ScrollArea type="auto">
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    withColumnBorders
                  >
                    <Table.Thead>
                      <Table.Tr>
                        {parsedTable[0]!.map((header, i) => (
                          <Table.Th key={i} style={{ whiteSpace: "nowrap" }}>
                            {formatCell(header)}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {previewRows.map((row, ri) => (
                        <Table.Tr key={ri}>
                          {row.map((cell, ci) => (
                            <Table.Td key={ci} style={{ whiteSpace: "nowrap" }}>
                              {cell == null ? "-" : formatCell(cell)}
                            </Table.Td>
                          ))}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </>
            );
          })()}
        </>
      )}
    </Modal>
  );

  return { open, modal };
}
