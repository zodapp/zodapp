import { ScrollArea, Table } from '@mantine/core';
import { formatCell, type TableCell, type Table as TabularTable } from '@zodapp/zod-tabular';

type Props = {
  headers: TableCell[];
  rows: TabularTable;
};

export function TabularPreviewTable({ headers, rows }: Props) {
  if (headers.length === 0) return null;

  return (
    <ScrollArea type="auto" mb="md">
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {headers.map((header, index) => (
              <Table.Th key={index} style={{ whiteSpace: 'nowrap' }}>
                {formatCell(header)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, rowIndex) => (
            <Table.Tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <Table.Td key={cellIndex} style={{ whiteSpace: 'nowrap' }}>
                  {formatCell(cell)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
