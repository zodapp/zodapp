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
import { IconDownload } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { toTable, tableToExcelCsv } from "@zodapp/zod-tabular";

interface ExportModalProps<S extends z.ZodType> {
  schema: S;
  data: z.infer<S>[];
  fetchAll: () => Promise<z.infer<S>[]>;
  filename?: string;
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExportModal<S extends z.ZodType>({
  schema,
  data,
  fetchAll,
  filename = "export.csv",
}: ExportModalProps<S>) {
  const [opened, { open, close }] = useDisclosure(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PREVIEW_LIMIT = 20;

  const previewData = useMemo(() => data.slice(0, PREVIEW_LIMIT), [data]);

  const previewTable = useMemo(() => {
    if (!opened || previewData.length === 0) return null;
    return toTable(schema, previewData);
  }, [opened, schema, previewData]);

  const handleDownload = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const allData = await fetchAll();
      if (allData.length === 0) {
        setError("エクスポート対象のデータがありません。");
        return;
      }
      const table = toTable(schema, allData);
      const csv = tableToExcelCsv(table);
      downloadCsv(csv, filename);
      close();
    } catch (e) {
      setError(
        e instanceof Error
          ? `取得エラー: ${e.message}`
          : "データの取得に失敗しました。",
      );
    } finally {
      setIsFetching(false);
    }
  }, [fetchAll, schema, filename, close]);

  const modal = (
    <Modal
      opened={opened}
      onClose={close}
      title="データエクスポート"
      size="calc(100vw - 3rem)"
    >
      {data.length === 0 ? (
        <Text c="dimmed">現在表示中のデータがありません。</Text>
      ) : (
        <>
          <Group justify="flex-end" mb="sm">
            <Button variant="default" onClick={close}>
              キャンセル
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleDownload}
              loading={isFetching}
            >
              全件取得してCSVダウンロード
            </Button>
          </Group>

          {error && (
            <Alert color="red" mb="md">
              {error}
            </Alert>
          )}

          <Text size="sm" mb="xs">
            先頭 {previewData.length} 件をプレビュー表示しています。
          </Text>
          <Text size="sm" c="dimmed" mb="sm">
            ダウンロード時は条件に一致する全件を取得してエクスポートします。
          </Text>

          {previewTable && (
            <ScrollArea type="auto">
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    {previewTable[0]!.map((header, i) => (
                      <Table.Th key={i} style={{ whiteSpace: "nowrap" }}>
                        {String(header)}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {previewTable.slice(1).map((row, ri) => (
                    <Table.Tr key={ri}>
                      {row.map((cell, ci) => (
                        <Table.Td key={ci} style={{ whiteSpace: "nowrap" }}>
                          {cell === null ? "" : String(cell)}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </>
      )}
    </Modal>
  );

  return { open, modal };
}
