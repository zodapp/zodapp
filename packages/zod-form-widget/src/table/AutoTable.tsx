import React, {
  Suspense,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Table, Loader } from "@mantine/core";
import {
  TableVirtuoso,
  type TableComponents,
  type TableVirtuosoHandle,
} from "react-virtuoso";
import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { getMetaReact } from "@zodapp/zod-form-react";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";
import {
  ZodFormContextProvider,
  Dynamic,
  tableComponentLibrary,
  ExternalKeyResolvers,
} from "@zodapp/zod-form-mantine";
import type { ExternalKeyActionResolver } from "@zodapp/zod-form-mantine";
import type { CollectionReferenceActionEntry } from "@zodapp/zod-form-react";
import { z } from "zod";
import { useColumnStorage } from "./useColumnStorage";
import { type ColumnEntry, getUnwrappedMeta } from "./table-types";
import styles from "./AutoTable.module.css";

export type CellAlign = "left" | "center" | "right";
type AutoTableField = {
  key: string;
  propertyName: string;
  schema: z.ZodTypeAny;
  meta: ReturnType<typeof getUnwrappedMeta>;
  width: number;
  align: CellAlign;
  isSortTarget: boolean;
  isAction: boolean;
  label: string;
};

type SetPreviewColumns = (
  value:
    | ColumnEntry[]
    | null
    | ((prev: ColumnEntry[] | null) => ColumnEntry[] | null),
) => void;

type OrderEntry = {
  fieldName: string;
  key: string;
  widthOverride?: number;
  isEmpty?: boolean;
};

type ResizableField = Pick<AutoTableField, "key" | "width" | "isAction">;

type SortOrder = "asc" | "desc";
type SortState = {
  sortKey: string;
  order: SortOrder;
};

export type AutoTableScrollState = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  isAtTop: boolean;
  isAtBottom: boolean;
};

export type AutoTableHandle = {
  scrollToTop: (options?: { behavior?: ScrollBehavior }) => void;
  scrollToBottom: (options?: { behavior?: ScrollBehavior }) => void;
  ensureFirstItemVisible: (options?: { offsetPx?: number }) => Promise<void>;
  ensureLastItemVisible: (options?: { offsetPx?: number }) => Promise<void>;
};

const SORTABLE_FIELD_TYPES = new Set([
  "string",
  "number",
  "enum",
  "date",
  "boolean",
]);

type AutoTableProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  data: Array<z.infer<T>>;
  keyField: string;
  externalKeyResolvers?: ExternalKeyResolvers;
  externalKeyActionResolver?: ExternalKeyActionResolver;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
  sortable?: boolean;
  defaultSortState?: SortState | null;
  storageKey?: string;
  isPreviewing?: boolean;
  scrollParent?: HTMLElement | null;
  virtualizeThreshold?: number;
  onScrollStateChange?: (state: AutoTableScrollState) => void;
};

const isSortableFieldType = (type: unknown) =>
  typeof type === "string" && SORTABLE_FIELD_TYPES.has(type);

const getNestedValue = (
  obj: Record<string, unknown>,
  path: string,
): unknown => {
  if (!path.includes(".")) return obj[path];
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
};

const resolveRecordChildSchema = (
  shape: z.ZodRawShape,
  fieldName: string,
): { schema: z.ZodTypeAny; label: string } | undefined => {
  const dotIndex = fieldName.indexOf(".");
  if (dotIndex === -1) return undefined;
  const parentKey = fieldName.slice(0, dotIndex);
  const childKey = fieldName.slice(dotIndex + 1);
  const parentSchema = shape[parentKey] as z.ZodTypeAny | undefined;
  if (!parentSchema) return undefined;
  let inner: z.ZodTypeAny = parentSchema;
  while (
    inner instanceof z.ZodOptional ||
    inner instanceof z.ZodNullable ||
    inner instanceof z.ZodDefault
  ) {
    inner = inner.unwrap() as z.ZodTypeAny;
  }
  if (!(inner instanceof z.ZodRecord)) return undefined;
  const valueSchema = inner.valueType as z.ZodTypeAny;
  return { schema: valueSchema, label: childKey };
};

const DEFAULT_WIDTH = 140;
const DEFAULT_ALIGN: CellAlign = "left";
export const COLUMN_FOCUS_ZONE_CLASS = "autoTable-columnFocusZone";
const SCROLL_EDGE_THRESHOLD = 8;
const USE_FIXED_WIDTH_IN_PREVIEW = true;

const EMPTY_COLUMN_SCHEMA = z.string().optional();
const EMPTY_COLUMN_META = getUnwrappedMeta(EMPTY_COLUMN_SCHEMA);

const ALIGN_CLASS_NAMES: Record<CellAlign, string> = {
  left: styles.alignLeft ?? "",
  center: styles.alignCenter ?? "",
  right: styles.alignRight ?? "",
};

const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
) => classNames.filter(Boolean).join(" ");

const buildScrollState = (element: HTMLElement): AutoTableScrollState => {
  const { scrollTop, clientHeight, scrollHeight } = element;
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    isAtTop: scrollTop <= SCROLL_EDGE_THRESHOLD,
    isAtBottom:
      scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_THRESHOLD,
  };
};

const toVirtuosoScrollBehavior = (
  behavior: ScrollBehavior,
): "auto" | "smooth" => (behavior === "smooth" ? "smooth" : "auto");

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const renderSortIcon = (sortOrder?: SortOrder) => {
  if (sortOrder === "asc") return <IconChevronUp size={16} stroke={2.5} />;
  if (sortOrder === "desc") return <IconChevronDown size={16} stroke={2.5} />;
  return <IconSelector size={14} stroke={1.8} />;
};

const getNextSortState = (
  current: SortState | null,
  sortKey: string,
): SortState | null => {
  if (current?.sortKey !== sortKey) {
    return {
      sortKey,
      order: "asc",
    };
  }

  if (current.order === "asc") {
    return {
      sortKey,
      order: "desc",
    };
  }

  return null;
};

const normalizeSortValue = (value: unknown): unknown => {
  if (value == null) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  return value;
};

const compareSortValues = (
  left: unknown,
  right: unknown,
  order: SortOrder,
): number => {
  const leftValue = normalizeSortValue(left);
  const rightValue = normalizeSortValue(right);

  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;

  let comparison = 0;

  if (leftValue > rightValue) {
    comparison = 1;
  } else if (leftValue < rightValue) {
    comparison = -1;
  } else {
    comparison = String(leftValue).localeCompare(String(rightValue), "ja", {
      numeric: true,
    });
  }

  return order === "asc" ? comparison : comparison * -1;
};

const MIN_COLUMN_WIDTH = 40;
const RESIZE_HIT_ZONE = 5;

function findColumnAtBoundary(
  tableEl: HTMLTableElement,
  clientX: number,
  fields: ResizableField[],
): string | null {
  const headerCells = tableEl.querySelectorAll("thead th");
  for (let i = 0; i < headerCells.length; i++) {
    const field = fields[i];
    if (!field || field.isAction) continue;
    const cell = headerCells[i];
    if (!cell) continue;
    const rect = cell.getBoundingClientRect();
    if (Math.abs(clientX - rect.right) <= RESIZE_HIT_ZONE) {
      return field.key;
    }
  }
  return null;
}

type UseTableResizeProps = {
  enabled: boolean;
  fields: ResizableField[];
  onResize: (columnKey: string, newWidth: number) => void;
  onActiveChange: (columnKey: string | null) => void;
};

function useTableResize({
  enabled,
  fields,
  onResize,
  onActiveChange,
}: UseTableResizeProps) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [tableElement, setTableElement] = useState<HTMLTableElement | null>(
    null,
  );
  const draggingRef = useRef<{
    columnKey: string;
    startX: number;
    originalWidth: number;
  } | null>(null);
  const dragStyleRef = useRef<HTMLStyleElement | null>(null);

  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  const tableRefCallback = useCallback((node: HTMLTableElement | null) => {
    tableRef.current = node;
    setTableElement((current) => (current === node ? current : node));
  }, []);

  const startDragStyle = useCallback(() => {
    if (!dragStyleRef.current) {
      const style = document.createElement("style");
      style.textContent =
        "* { cursor: col-resize !important; user-select: none !important; }";
      document.head.appendChild(style);
      dragStyleRef.current = style;
    }
  }, []);

  const stopDragStyle = useCallback(() => {
    if (dragStyleRef.current) {
      dragStyleRef.current.remove();
      dragStyleRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) return;
    draggingRef.current = null;
    onActiveChangeRef.current(null);
    tableRef.current?.style.setProperty("cursor", "");
    stopDragStyle();
  }, [enabled, stopDragStyle]);

  useEffect(
    () => () => {
      draggingRef.current = null;
      onActiveChangeRef.current(null);
      stopDragStyle();
    },
    [stopDragStyle],
  );

  useEffect(() => {
    const table = tableElement;
    if (!enabled || !table) return;

    const onMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const delta = e.clientX - draggingRef.current.startX;
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          draggingRef.current.originalWidth + delta,
        );
        onResizeRef.current(draggingRef.current.columnKey, newWidth);
        return;
      }

      const hit = findColumnAtBoundary(table, e.clientX, fieldsRef.current);
      table.style.cursor = hit ? "col-resize" : "";
      onActiveChangeRef.current(hit);
    };

    const onMouseDown = (e: MouseEvent) => {
      const hit = findColumnAtBoundary(table, e.clientX, fieldsRef.current);
      if (!hit) return;

      const field = fieldsRef.current.find((f) => f.key === hit);
      if (!field) return;

      e.preventDefault();
      draggingRef.current = {
        columnKey: hit,
        startX: e.clientX,
        originalWidth: field.width,
      };
      onActiveChangeRef.current(hit);
      startDragStyle();
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      onActiveChangeRef.current(null);
      stopDragStyle();
      tableRef.current?.style.setProperty("cursor", "");
    };

    const onMouseLeave = () => {
      if (!draggingRef.current) {
        table.style.cursor = "";
        onActiveChangeRef.current(null);
      }
    };

    const onDocMouseMove = (ev: MouseEvent) => {
      if (draggingRef.current) onMouseMove(ev);
    };

    table.addEventListener("mousemove", onMouseMove);
    table.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onDocMouseMove);
    table.addEventListener("mouseleave", onMouseLeave);

    return () => {
      table.removeEventListener("mousemove", onMouseMove);
      table.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onDocMouseMove);
      table.removeEventListener("mouseleave", onMouseLeave);
      table.style.cursor = "";
      if (!draggingRef.current) {
        onActiveChangeRef.current(null);
        stopDragStyle();
      }
    };
  }, [enabled, startDragStyle, stopDragStyle, tableElement]);

  return { tableRef, tableRefCallback };
}

function buildTableSchema<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): z.ZodObject<z.ZodRawShape> {
  return schema;
}

function getOrderEntries(
  schemaOrder: string[],
  storageColumns: ColumnEntry[] | null,
  isPreviewing: boolean,
): OrderEntry[] {
  const storageDerived = storageColumns
    ? storageColumns
        .filter((column) => column.fieldName || isPreviewing)
        .map((column) => {
          const width = Number(column.width);
          return {
            fieldName: column.fieldName ?? "",
            key: column.id,
            widthOverride:
              !Number.isNaN(width) && width > 0 ? width : undefined,
            isEmpty: !column.fieldName,
          };
        })
    : null;

  return (
    storageDerived ??
    schemaOrder.map((fieldName) => ({ fieldName, key: fieldName }))
  );
}

function buildFields(
  tableSchema: z.ZodObject<z.ZodRawShape>,
  orderEntries: OrderEntry[],
): AutoTableField[] {
  return orderEntries.flatMap((entry) => {
    if (entry.isEmpty) {
      return [
        {
          key: entry.key,
          propertyName: "",
          schema: EMPTY_COLUMN_SCHEMA,
          meta: EMPTY_COLUMN_META,
          width: entry.widthOverride ?? DEFAULT_WIDTH,
          align: DEFAULT_ALIGN,
          isSortTarget: false,
          isAction: false,
          label: "",
        },
      ];
    }

    let fieldSchema = tableSchema.shape[entry.fieldName] as
      | z.ZodTypeAny
      | undefined;
    let fieldMeta: ReturnType<typeof getUnwrappedMeta>;

    if (!fieldSchema) {
      const resolved = resolveRecordChildSchema(
        tableSchema.shape,
        entry.fieldName,
      );
      if (!resolved) return [];
      fieldSchema = resolved.schema;
      fieldMeta = { ...getUnwrappedMeta(fieldSchema), label: resolved.label };
    } else {
      fieldMeta = getUnwrappedMeta(fieldSchema);
    }

    if (fieldMeta.hidden || fieldMeta.tags?.includes("hidden")) return [];

    const width = entry.widthOverride ?? fieldMeta.width ?? DEFAULT_WIDTH;
    const align = (fieldMeta.align as CellAlign | undefined) ?? DEFAULT_ALIGN;

    return [
      {
        key: entry.key,
        propertyName: entry.fieldName,
        schema: fieldSchema,
        meta: fieldMeta,
        width,
        align,
        isSortTarget: isSortableFieldType(fieldMeta.schemaType),
        isAction: false,
        label: fieldMeta.label ?? entry.fieldName,
      },
    ];
  });
}

const buildDefaultPreviewColumns = (fields: AutoTableField[]): ColumnEntry[] =>
  fields
    .filter((field) => !field.isAction)
    .map((field) => ({
      id: field.key,
      fieldName: field.propertyName,
      width: String(field.width),
    }));

type UseAutoTableModelProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  data: Array<z.infer<T>>;
  storageColumns: ColumnEntry[] | null;
  isPreviewing: boolean;
  sortable: boolean;
  sortState: SortState | null;
};

function useAutoTableModel<T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  data,
  storageColumns,
  isPreviewing,
  sortable,
  sortState,
}: UseAutoTableModelProps<T>) {
  const { fields, totalMinWidth } = useMemo(() => {
    const tableSchema = buildTableSchema(schema);
    const tableMeta = getMetaReact(tableSchema, "object");
    const schemaOrder = tableMeta?.properties ?? Object.keys(tableSchema.shape);
    const orderEntries = getOrderEntries(
      schemaOrder,
      storageColumns,
      isPreviewing,
    );
    const nextFields = buildFields(tableSchema, orderEntries);

    return {
      fields: nextFields,
      totalMinWidth: nextFields.reduce((sum, field) => sum + field.width, 0),
    };
  }, [isPreviewing, schema, storageColumns]);

  const sortedData = useMemo(() => {
    if (!sortable || !sortState) return data;

    const sortField = fields.find(
      ({ propertyName }) => propertyName === sortState.sortKey,
    );
    if (!sortField?.isSortTarget) return data;

    return data
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const comparison = compareSortValues(
          getNestedValue(left.item, sortField.propertyName),
          getNestedValue(right.item, sortField.propertyName),
          sortState.order,
        );

        return comparison !== 0 ? comparison : left.index - right.index;
      })
      .map(({ item }) => item);
  }, [data, fields, sortState, sortable]);

  return { fields, sortedData, totalMinWidth };
}

type UseAutoTablePreviewProps = {
  isPreviewing: boolean;
  fields: AutoTableField[];
  setPreviewColumns: SetPreviewColumns;
  focusedColumnId: string | undefined;
  setFocusedColumnId: (columnId: string | undefined) => void;
};

function useAutoTablePreview({
  isPreviewing,
  fields,
  setPreviewColumns,
  focusedColumnId,
  setFocusedColumnId,
}: UseAutoTablePreviewProps) {
  const [activeResizeColumn, setActiveResizeColumn] = useState<string | null>(
    null,
  );

  const resizeFields = useMemo<ResizableField[]>(
    () => fields.map(({ key, width, isAction }) => ({ key, width, isAction })),
    [fields],
  );

  const handleColumnResize = useCallback(
    (columnKey: string, newWidth: number) => {
      setPreviewColumns((prev) => {
        const columns = prev ?? buildDefaultPreviewColumns(fields);
        return columns.map((column) => {
          if (column.id !== columnKey) return column;
          return { ...column, width: String(newWidth) };
        });
      });
    },
    [fields, setPreviewColumns],
  );

  const { tableRef, tableRefCallback } = useTableResize({
    enabled: isPreviewing,
    fields: resizeFields,
    onResize: handleColumnResize,
    onActiveChange: setActiveResizeColumn,
  });

  const focusedThRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    if (isPreviewing && focusedColumnId && focusedThRef.current) {
      focusedThRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isPreviewing, focusedColumnId, fields]);

  useEffect(() => {
    if (!isPreviewing || !focusedColumnId) return;

    const handleDocClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      if (
        target.closest?.(
          `.${COLUMN_FOCUS_ZONE_CLASS}, [data-combobox-dropdown], [data-combobox-option]`,
        )
      )
        return;
      setFocusedColumnId(undefined);
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [isPreviewing, focusedColumnId, setFocusedColumnId]);

  const handlePreviewPointerDown = useCallback(
    (columnKey: string, clientX: number) => {
      const table = tableRef.current;
      if (table && findColumnAtBoundary(table, clientX, resizeFields)) return;
      setFocusedColumnId(columnKey);
    },
    [resizeFields, setFocusedColumnId],
  );

  return {
    activeResizeColumn,
    focusedThRef,
    handlePreviewPointerDown,
    tableRef,
    tableRefCallback,
  };
}

type PreviewPointerDownHandler = (columnKey: string, clientX: number) => void;

type ReactObjectRefLike<T> = {
  current: T | null;
};

type ReactRefCallbackLike<T> = (node: T | null) => void;

type HeaderCellProps = {
  field: AutoTableField;
  isPreviewing: boolean;
  totalMinWidth: number;
  canSort: boolean;
  sortOrder?: SortOrder;
  isFocused: boolean;
  isResizing: boolean;
  onPreviewPointerDown: PreviewPointerDownHandler;
  onSortToggle: (sortKey: string) => void;
  cellRef?: ReactObjectRefLike<HTMLTableCellElement>;
};

function HeaderCellInner({
  field,
  isPreviewing,
  totalMinWidth,
  canSort,
  sortOrder,
  isFocused,
  isResizing,
  onPreviewPointerDown,
  onSortToggle,
  cellRef,
}: HeaderCellProps) {
  const isPreviewSelectable = isPreviewing && !field.isAction;
  const isSorted = sortOrder != null;
  const headerWidth =
    isPreviewing && USE_FIXED_WIDTH_IN_PREVIEW
      ? field.width
      : `${(field.width / totalMinWidth) * 100}%`;

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      onPreviewPointerDown(field.key, event.clientX);
    },
    [field.key, onPreviewPointerDown],
  );

  const handleSortClick = useCallback(() => {
    onSortToggle(field.propertyName);
  }, [field.propertyName, onSortToggle]);

  return (
    <Table.Th
      ref={cellRef}
      className={joinClassNames(
        styles.headerCell,
        isPreviewSelectable && styles.previewHeaderCell,
        isPreviewSelectable && styles.previewSelectable,
      )}
      data-focused={isPreviewSelectable && isFocused ? true : undefined}
      data-resizing={isPreviewSelectable && isResizing ? true : undefined}
      onMouseDown={isPreviewSelectable ? handleMouseDown : undefined}
      style={{ width: headerWidth }}
    >
      <div className={isPreviewing ? styles.previewContent : undefined}>
        {canSort ? (
          <button
            type="button"
            className={styles.sortButton}
            data-sorted={isSorted || undefined}
            onClick={handleSortClick}
            aria-label={`${field.label}を並び替え`}
          >
            <span>{field.label}</span>
            <span
              className={styles.sortIcon}
              data-sorted={isSorted || undefined}
            >
              {renderSortIcon(sortOrder)}
            </span>
          </button>
        ) : (
          field.label
        )}
      </div>
    </Table.Th>
  );
}

const HeaderCell = memo(HeaderCellInner);

type BodyCellProps = {
  field: AutoTableField;
  item: Record<string, unknown>;
  isPreviewing: boolean;
  isFocused: boolean;
  isResizing: boolean;
  onPreviewPointerDown: PreviewPointerDownHandler;
};

function BodyCellInner({
  field,
  item,
  isPreviewing,
  isFocused,
  isResizing,
  onPreviewPointerDown,
}: BodyCellProps) {
  const isPreviewSelectable = isPreviewing && !field.isAction;

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      onPreviewPointerDown(field.key, event.clientX);
    },
    [field.key, onPreviewPointerDown],
  );

  return (
    <Table.Td
      className={joinClassNames(
        ALIGN_CLASS_NAMES[field.align],
        isPreviewSelectable && styles.previewSelectable,
      )}
      data-focused={isPreviewSelectable && isFocused ? true : undefined}
      data-resizing={isPreviewSelectable && isResizing ? true : undefined}
      onMouseDown={isPreviewSelectable ? handleMouseDown : undefined}
    >
      <div className={isPreviewing ? styles.previewContent : undefined}>
        {field.propertyName ? (
          <Suspense fallback={<Loader size="xs" />}>
            <Dynamic
              fieldPath={field.propertyName}
              schema={field.schema}
              defaultValue={
                field.meta.typeName === "computed"
                  ? item
                  : getNestedValue(item, field.propertyName)
              }
            />
          </Suspense>
        ) : null}
      </div>
    </Table.Td>
  );
}

const BodyCell = memo(BodyCellInner);

const DEFAULT_ITEM_HEIGHT = 38;

type SharedViewProps = {
  fields: AutoTableField[];
  sortedData: Array<Record<string, unknown>>;
  keyField: string;
  totalMinWidth: number;
  isPreviewing: boolean;
  sortable: boolean;
  sortState: SortState | null;
  focusedColumnId: string | undefined;
  activeResizeColumn: string | null;
  focusedThRef: ReactObjectRefLike<HTMLTableCellElement>;
  handlePreviewPointerDown: PreviewPointerDownHandler;
  handleSortToggle: (sortKey: string) => void;
  tableClassName: string;
  tableStyle: React.CSSProperties;
};

function LegacyTableView({
  fields,
  sortedData,
  keyField,
  totalMinWidth,
  isPreviewing,
  sortable,
  sortState,
  focusedColumnId,
  activeResizeColumn,
  focusedThRef,
  handlePreviewPointerDown,
  handleSortToggle,
  tableClassName,
  tableStyle,
  tableRefCallback,
}: SharedViewProps & { tableRefCallback: ReactRefCallbackLike<HTMLTableElement> }) {
  return (
    <Table
      ref={tableRefCallback}
      className={tableClassName}
      striped
      highlightOnHover
      style={tableStyle}
    >
      <Table.Thead>
        <Table.Tr className={styles.stickyHeaderRow}>
          {fields.map((field) => (
            <HeaderCell
              key={field.key}
              field={field}
              cellRef={focusedColumnId === field.key ? focusedThRef : undefined}
              isPreviewing={isPreviewing}
              totalMinWidth={totalMinWidth}
              canSort={sortable && field.isSortTarget}
              sortOrder={
                sortState?.sortKey === field.propertyName
                  ? sortState.order
                  : undefined
              }
              isFocused={focusedColumnId === field.key}
              isResizing={activeResizeColumn === field.key}
              onPreviewPointerDown={handlePreviewPointerDown}
              onSortToggle={handleSortToggle}
            />
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sortedData.map((item) => (
          <Table.Tr key={String(item[keyField])}>
            {fields.map((field) => (
              <BodyCell
                key={field.key}
                field={field}
                item={item}
                isPreviewing={isPreviewing}
                isFocused={focusedColumnId === field.key}
                isResizing={activeResizeColumn === field.key}
                onPreviewPointerDown={handlePreviewPointerDown}
              />
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function VirtualizedTableView({
  fields,
  sortedData,
  keyField,
  totalMinWidth,
  isPreviewing,
  sortable,
  sortState,
  focusedColumnId,
  activeResizeColumn,
  focusedThRef,
  handlePreviewPointerDown,
  handleSortToggle,
  tableClassName,
  tableStyle,
  tableRefCallback,
  scrollParent,
  virtuosoRef,
}: SharedViewProps & {
  tableRefCallback: (node: HTMLTableElement | null) => void;
  scrollParent: HTMLElement;
  virtuosoRef: React.RefObject<TableVirtuosoHandle | null>;
}) {
  type RowData = Record<string, unknown>;
  const tableClassNameRef = useRef(tableClassName);
  tableClassNameRef.current = tableClassName;
  const tableStyleRef = useRef(tableStyle);
  tableStyleRef.current = tableStyle;

  const components = useMemo<TableComponents<RowData>>(
    () => ({
      Table: React.forwardRef<
        HTMLTableElement,
        React.ComponentPropsWithRef<"table">
      >(({ style, ...props }, _ref) => (
        <Table
          {...props}
          ref={tableRefCallback}
          className={tableClassNameRef.current}
          striped
          highlightOnHover
          style={{ ...tableStyleRef.current, ...style }}
        />
      )),
      TableRow: ({ style, item, ...props }) => (
        <tr
          {...props}
          style={style}
          key={item ? String(item[keyField]) : undefined}
        />
      ),
    }),
    [keyField, tableRefCallback],
  );

  const fixedHeaderContent = useCallback(
    () => (
      <Table.Tr className={styles.stickyHeaderRow}>
        {fields.map((field) => (
          <HeaderCell
            key={field.key}
            field={field}
            cellRef={focusedColumnId === field.key ? focusedThRef : undefined}
            isPreviewing={isPreviewing}
            totalMinWidth={totalMinWidth}
            canSort={sortable && field.isSortTarget}
            sortOrder={
              sortState?.sortKey === field.propertyName
                ? sortState.order
                : undefined
            }
            isFocused={focusedColumnId === field.key}
            isResizing={activeResizeColumn === field.key}
            onPreviewPointerDown={handlePreviewPointerDown}
            onSortToggle={handleSortToggle}
          />
        ))}
      </Table.Tr>
    ),
    [
      fields,
      totalMinWidth,
      isPreviewing,
      sortable,
      sortState,
      focusedColumnId,
      activeResizeColumn,
      focusedThRef,
      handlePreviewPointerDown,
      handleSortToggle,
    ],
  );

  const itemContent = useCallback(
    (_index: number, item: Record<string, unknown>) => (
      <>
        {fields.map((field) => (
          <BodyCell
            key={field.key}
            field={field}
            item={item}
            isPreviewing={isPreviewing}
            isFocused={focusedColumnId === field.key}
            isResizing={activeResizeColumn === field.key}
            onPreviewPointerDown={handlePreviewPointerDown}
          />
        ))}
      </>
    ),
    [
      fields,
      isPreviewing,
      focusedColumnId,
      activeResizeColumn,
      handlePreviewPointerDown,
    ],
  );

  const computeItemKey = useCallback(
    (_index: number, item: Record<string, unknown>) => String(item[keyField]),
    [keyField],
  );

  return (
    <TableVirtuoso
      ref={virtuosoRef}
      data={sortedData}
      customScrollParent={scrollParent}
      defaultItemHeight={DEFAULT_ITEM_HEIGHT}
      fixedHeaderContent={fixedHeaderContent}
      itemContent={itemContent}
      computeItemKey={computeItemKey}
      components={components}
      increaseViewportBy={200}
    />
  );
}

const AutoTableInner = <T extends z.ZodObject<z.ZodRawShape>>(
  {
    schema,
    data,
    keyField,
    externalKeyResolvers,
    externalKeyActionResolver,
    resolverContext,
    collectionReferenceActions,
    sortable = true,
    defaultSortState = null,
    storageKey,
    isPreviewing = false,
    scrollParent,
    virtualizeThreshold,
    onScrollStateChange,
  }: AutoTableProps<T>,
  ref: React.ForwardedRef<AutoTableHandle>,
) => {
  const [sortState, setSortState] = useState<SortState | null>(
    defaultSortState,
  );
  const {
    columns: storageColumns,
    setPreviewColumns,
    focusedColumnId,
    setFocusedColumnId,
  } = useColumnStorage(storageKey, isPreviewing);
  const { fields, sortedData, totalMinWidth } = useAutoTableModel({
    schema,
    data,
    storageColumns,
    isPreviewing,
    sortable,
    sortState,
  });

  const {
    activeResizeColumn,
    focusedThRef,
    handlePreviewPointerDown,
    tableRef,
    tableRefCallback,
  } = useAutoTablePreview({
    isPreviewing,
    fields,
    setPreviewColumns,
    focusedColumnId,
    setFocusedColumnId,
  });

  const tableClassName = joinClassNames(
    styles.table,
    isPreviewing && COLUMN_FOCUS_ZONE_CLASS,
  );
  const tableStyle = useMemo<React.CSSProperties>(() => {
    if (isPreviewing && USE_FIXED_WIDTH_IN_PREVIEW) {
      return {
        tableLayout: "fixed",
        width: totalMinWidth,
        ["--table-vertical-spacing" as string]: "5px",
        ["--table-horizontal-spacing" as string]: "5px",
      };
    }

    return {
      tableLayout: "fixed",
      width: "100%",
      minWidth: totalMinWidth,
      ["--table-vertical-spacing" as string]: "5px",
      ["--table-horizontal-spacing" as string]: "5px",
    };
  }, [isPreviewing, totalMinWidth]);

  const handleSortToggle = useCallback((sortKey: string) => {
    setSortState((current) => getNextSortState(current, sortKey));
  }, []);

  const useVirtualized =
    virtualizeThreshold != null &&
    scrollParent != null &&
    data.length >= virtualizeThreshold;
  const virtuosoRef = useRef<TableVirtuosoHandle | null>(null);

  const getScrollElement = useCallback(
    () => scrollParent ?? tableRef.current?.parentElement ?? null,
    [scrollParent, tableRef],
  );

  const ensureFirstItemVisible = useCallback(
    async ({ offsetPx = 0 } = {}) => {
      if (!useVirtualized || !virtuosoRef.current) return;

      const scrollElement = getScrollElement();

      for (let attempt = 0; attempt < 4; attempt += 1) {
        virtuosoRef.current.scrollToIndex({
          index: 0,
          align: "start",
          behavior: "auto",
        });

        await waitForAnimationFrame();
        await waitForAnimationFrame();

        if ((scrollElement?.scrollTop ?? 0) <= SCROLL_EDGE_THRESHOLD + offsetPx)
          break;
      }

      if (offsetPx > 0 && scrollElement) {
        scrollElement.scrollTo({ top: offsetPx, behavior: "auto" });
      }
    },
    [getScrollElement, useVirtualized],
  );

  const ensureLastItemVisible = useCallback(
    async ({ offsetPx = 0 } = {}) => {
      if (!useVirtualized || !virtuosoRef.current) return;

      const scrollElement = getScrollElement();
      let previousScrollHeight = -1;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        virtuosoRef.current.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });

        await waitForAnimationFrame();
        await waitForAnimationFrame();

        const nextScrollHeight =
          scrollElement?.scrollHeight ?? previousScrollHeight;
        if (nextScrollHeight === previousScrollHeight) break;
        previousScrollHeight = nextScrollHeight;
      }

      if (offsetPx > 0 && scrollElement) {
        const maxScroll =
          scrollElement.scrollHeight - scrollElement.clientHeight;
        scrollElement.scrollTo({
          top: Math.max(0, maxScroll - offsetPx),
          behavior: "auto",
        });
      }
    },
    [getScrollElement, useVirtualized],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: ({ behavior = "smooth" } = {}) => {
        if (useVirtualized && virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: 0,
            align: "start",
            behavior: toVirtuosoScrollBehavior(behavior),
          });
          return;
        }
        const element = getScrollElement();
        if (!element) return;
        element.scrollTo({ top: 0, behavior });
      },
      scrollToBottom: ({ behavior = "smooth" } = {}) => {
        if (useVirtualized && virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: "LAST",
            align: "end",
            behavior: toVirtuosoScrollBehavior(behavior),
          });
          return;
        }
        const element = getScrollElement();
        if (!element) return;
        element.scrollTo({ top: element.scrollHeight, behavior });
      },
      ensureFirstItemVisible,
      ensureLastItemVisible,
    }),
    [
      ensureFirstItemVisible,
      ensureLastItemVisible,
      getScrollElement,
      useVirtualized,
    ],
  );

  useEffect(() => {
    const element = getScrollElement();
    if (!element || !onScrollStateChange) return;

    const notifyScrollState = () => {
      onScrollStateChange(buildScrollState(element));
    };

    notifyScrollState();
    element.addEventListener("scroll", notifyScrollState, { passive: true });
    return () => element.removeEventListener("scroll", notifyScrollState);
  }, [data.length, getScrollElement, onScrollStateChange, useVirtualized]);

  return (
    <ZodFormContextProvider
      componentLibrary={tableComponentLibrary}
      externalKeyResolvers={externalKeyResolvers}
      externalKeyActionResolver={externalKeyActionResolver}
      resolverContext={resolverContext}
      collectionReferenceActions={collectionReferenceActions}
    >
      {useVirtualized ? (
        <VirtualizedTableView
          fields={fields}
          sortedData={sortedData}
          keyField={keyField}
          totalMinWidth={totalMinWidth}
          isPreviewing={isPreviewing}
          sortable={sortable}
          sortState={sortState}
          focusedColumnId={focusedColumnId}
          activeResizeColumn={activeResizeColumn}
          focusedThRef={focusedThRef}
          handlePreviewPointerDown={handlePreviewPointerDown}
          handleSortToggle={handleSortToggle}
          tableClassName={tableClassName}
          tableStyle={tableStyle}
          tableRefCallback={tableRefCallback}
          scrollParent={scrollParent}
          virtuosoRef={virtuosoRef}
        />
      ) : (
        <LegacyTableView
          fields={fields}
          sortedData={sortedData}
          keyField={keyField}
          totalMinWidth={totalMinWidth}
          isPreviewing={isPreviewing}
          sortable={sortable}
          sortState={sortState}
          focusedColumnId={focusedColumnId}
          activeResizeColumn={activeResizeColumn}
          focusedThRef={focusedThRef}
          handlePreviewPointerDown={handlePreviewPointerDown}
          handleSortToggle={handleSortToggle}
          tableClassName={tableClassName}
          tableStyle={tableStyle}
          tableRefCallback={tableRefCallback}
        />
      )}
    </ZodFormContextProvider>
  );
};

type AutoTableComponent = <T extends z.ZodObject<z.ZodRawShape>>(
  props: AutoTableProps<T> & React.RefAttributes<AutoTableHandle>,
) => React.ReactElement | null;

const ForwardedAutoTable = forwardRef(AutoTableInner) as AutoTableComponent;

export const AutoTable = memo(ForwardedAutoTable) as AutoTableComponent;
