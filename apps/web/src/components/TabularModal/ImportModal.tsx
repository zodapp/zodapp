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
import { fromStringTable, type StringTable } from "@zodapp/zod-tabular";
import { csvToStringTable } from "./csvUtils";

const PREVIEW_LIMIT = 20;

interface ImportModalProps<S extends z.ZodType> {
  schema: S;
  onImport: (rows: z.infer<S>[]) => Promise<void>;
}

export function useImportModal<S extends z.ZodType>({
  schema,
  onImport,
}: ImportModalProps<S>) {
  const [opened, { open, close }] = useDisclosure(false);
  const [parsedTable, setParsedTable] = useState<StringTable | null>(null);
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
          const table = csvToStringTable(csv);
          console.log("csvToStringTable", table);
          if (table.length < 2) {
            setError("ヘッダ行のみ、またはデータが空です。");
            return;
          }
          setParsedTable(table);
          const rows = fromStringTable(schema, table);
          setParsedRows(rows);
        } catch (e) {
          console.log("parse error", e);
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
      console.log("インポートエラー", e);
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
            const previewRows = parsedTable.slice(1, PREVIEW_LIMIT + 1);
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
                  {totalRows} 件のデータを読み込みました。
                  {previewCount < totalRows &&
                    `（先頭 ${previewCount} 件をプレビュー表示）`}
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
                            {header}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {previewRows.map((row, ri) => (
                        <Table.Tr key={ri}>
                          {row.map((cell, ci) => (
                            <Table.Td key={ci} style={{ whiteSpace: "nowrap" }}>
                              {cell}
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
