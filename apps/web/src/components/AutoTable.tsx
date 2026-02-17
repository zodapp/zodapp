import React, { Suspense, memo } from "react";
import { Table, ActionIcon, Loader } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { getMetaReact } from "@zodapp/zod-form-react";
import { getMeta } from "@zodapp/zod-form";
import {
  ZodFormContextProvider,
  Dynamic,
  tableComponentLibrary,
} from "@zodapp/zod-form-mantine";
import { z } from "zod";

type ActionParams = LinkProps;

type AutoTableProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  data: Array<z.infer<T>>;
  keyField: string;
  actionParams: (item: z.infer<T>) => ActionParams;
};

/**
 * optional, nullable, default でラップされている場合に内部の型のメタデータを取得する
 * ヘッダーのラベル取得用（コンポーネントのunwrapとは別の用途）
 */
const getUnwrappedMeta = (schema: z.ZodTypeAny) => {
  let currentSchema: z.ZodTypeAny = schema;
  let meta = getMetaReact(currentSchema);

  // メタデータにlabelがない場合、内部の型を再帰的にチェック
  while (!meta?.label) {
    if (currentSchema instanceof z.ZodOptional) {
      currentSchema = currentSchema.unwrap() as z.ZodTypeAny;
    } else if (currentSchema instanceof z.ZodNullable) {
      currentSchema = currentSchema.unwrap() as z.ZodTypeAny;
    } else if (currentSchema instanceof z.ZodDefault) {
      currentSchema = currentSchema.removeDefault() as z.ZodTypeAny;
    } else {
      break;
    }
    meta = getMetaReact(currentSchema);
  }

  return meta;
};

/**
 * optional, nullable, default でラップされている場合に内部の型の width メタを取得する
 */
const getUnwrappedWidth = (schema: z.ZodTypeAny): number | undefined => {
  let current: z.ZodTypeAny = schema;
  let meta = getMeta(current);
  while (meta?.width === undefined) {
    if (current instanceof z.ZodOptional) {
      current = current.unwrap() as z.ZodTypeAny;
    } else if (current instanceof z.ZodNullable) {
      current = current.unwrap() as z.ZodTypeAny;
    } else if (current instanceof z.ZodDefault) {
      current = current.removeDefault() as z.ZodTypeAny;
    } else {
      break;
    }
    meta = getMeta(current);
  }
  return meta?.width;
};

const DEFAULT_WIDTH = 150;
const ACTION_WIDTH = 80;

const AutoTableInner = <T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  data,
  keyField,
  actionParams,
}: AutoTableProps<T>) => {
  const meta = getMetaReact(schema, "object");
  const order: string[] = meta?.properties ?? Object.keys(schema.shape);

  // hidden フィールドを除外
  const fields = order.flatMap((propertyName) => {
    const fieldSchema = schema.shape[propertyName] as z.ZodTypeAny;
    if (!fieldSchema) return [];
    // ヘッダー用にunwrapしたメタデータを取得
    const fieldMeta = getUnwrappedMeta(fieldSchema);
    if (fieldMeta?.hidden || fieldMeta?.tags?.includes("hidden")) return [];
    const width = getUnwrappedWidth(fieldSchema) ?? DEFAULT_WIDTH;
    return [{ propertyName, schema: fieldSchema, meta: fieldMeta, width }];
  });

  const totalMinWidth =
    fields.reduce((sum, f) => sum + f.width, 0) + ACTION_WIDTH;

  return (
    <ZodFormContextProvider componentLibrary={tableComponentLibrary}>
      <div style={{ overflowX: "auto" }}>
        <Table
          striped
          highlightOnHover
          style={{
            tableLayout: "fixed",
            width: "100%",
            minWidth: totalMinWidth,
          }}
        >
          <Table.Thead>
            <Table.Tr
              style={{
                position: "sticky",
                top: 0,
                backgroundColor: "white",
                zIndex: 10,
              }}
            >
              {fields.map(({ propertyName, width, meta: fieldMeta }) => (
                <Table.Th
                  key={propertyName}
                  style={{
                    width: `${(width / totalMinWidth) * 100}%`,
                    textAlign: "center",
                  }}
                >
                  {fieldMeta?.label ?? propertyName}
                </Table.Th>
              ))}
              <Table.Th
                style={{
                  width: `${(ACTION_WIDTH / totalMinWidth) * 100}%`,
                }}
              >
                操作
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={String(item[keyField])}>
                {fields.map(
                  ({ propertyName, schema: fieldSchema, meta: fieldMeta }) => (
                    <Table.Td key={propertyName}>
                      <Suspense fallback={<Loader size="xs" />}>
                        <Dynamic
                          fieldPath={propertyName}
                          schema={fieldSchema}
                          defaultValue={
                            fieldMeta?.typeName === "computed"
                              ? item
                              : item[propertyName]
                          }
                        />
                      </Suspense>
                    </Table.Td>
                  ),
                )}
                <Table.Td>
                  <Link
                    {...actionParams(item)}
                    style={{ textDecoration: "none" }}
                  >
                    <ActionIcon variant="subtle">
                      <IconArrowRight size={16} />
                    </ActionIcon>
                  </Link>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </ZodFormContextProvider>
  );
};

export const AutoTable = memo(AutoTableInner) as typeof AutoTableInner;
