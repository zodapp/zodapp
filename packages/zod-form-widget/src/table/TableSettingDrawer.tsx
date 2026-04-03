import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
} from "@mantine/core";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import { COLUMN_FOCUS_ZONE_CLASS } from "./AutoTable";
import { type ColumnEntry } from "./table-types";
import { extractSchemaColumns } from "./extract-schema-columns";
import type { ColumnSettingsController } from "./column-settings-controller";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_WIDTH = 140;

export type { ColumnEntry };

export type ExtraFieldOption = {
  value: string;
  label: string;
  group?: string;
  width?: number;
};

interface UseTableSettingDrawerProps {
  controller: ColumnSettingsController;
  extraFieldOptions?: ExtraFieldOption[];
}

let nextId = 0;
const generateId = () => `col_${Date.now()}_${nextId++}`;

const createEmptyColumn = (): ColumnEntry => ({
  fieldPath: "",
  width: String(DEFAULT_WIDTH),
  id: generateId(),
});

const ensureIds = (columns: ColumnEntry[]): ColumnEntry[] =>
  columns.map((col) => (col.id ? col : { ...col, id: generateId() }));

type FieldOptionWithGroup = { value: string; label: string; group?: string };
type SelectDataItem =
  | { value: string; label: string }
  | { group: string; items: { value: string; label: string }[] };

const toSelectData = (options: FieldOptionWithGroup[]): SelectDataItem[] => {
  const ungrouped: { value: string; label: string }[] = [];
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const opt of options) {
    if (opt.group) {
      let items = groups.get(opt.group);
      if (!items) {
        items = [];
        groups.set(opt.group, items);
      }
      items.push({ value: opt.value, label: opt.label });
    } else {
      ungrouped.push({ value: opt.value, label: opt.label });
    }
  }
  const result: SelectDataItem[] = [...ungrouped];
  for (const [group, items] of groups) {
    result.push({ group, items });
  }
  return result;
};

interface SortableColumnProps {
  col: ColumnEntry;
  fieldOptions: SelectDataItem[];
  onFieldChange: (id: string, newFieldName: string | null) => void;
  onWidthChange: (id: string, newWidth: string | number) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  isLast: boolean;
  onAddAfterLast: () => void;
  isFocused: boolean;
  onFocusColumn: (id: string) => void;
  onBlurColumn: () => void;
}

function SortableColumn({
  col,
  fieldOptions,
  onFieldChange,
  onWidthChange,
  onAdd,
  onRemove,
  canRemove,
  isLast,
  onAddAfterLast,
  isFocused,
  onFocusColumn,
  onBlurColumn,
}: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: col.id,
  });

  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && elRef.current) {
      elRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isFocused]);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        elRef.current = node;
      }}
      style={{
        flex: `0 0 168px`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        boxSizing: "border-box",
        padding: "24px 12px 2px",
        scrollMargin: "8px",
      }}
      onMouseDown={() => onFocusColumn(col.id)}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: -2,
          right: -2,
          bottom: -4,
          borderRadius: 4,
          border: `2px solid ${isFocused ? "var(--mantine-primary-color-filled)" : "transparent"}`,
          pointerEvents: "none",
        }}
      />
      {canRemove && (
        <ActionIcon
          size={20}
          variant="light"
          color="#63687C"
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "white",
            zIndex: 2,
            outline: "none",
          }}
          onClick={() => onRemove(col.id)}
        >
          <IconCircleMinus />
        </ActionIcon>
      )}

      <ActionIcon
        size={20}
        variant="light"
        color="#63687C"
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          transform: "translate(-50%, -50%)",
          backgroundColor: "white",
          zIndex: 3,
          outline: "none",
        }}
        onClick={() => onAdd(col.id)}
      >
        <IconCirclePlus />
      </ActionIcon>

      {isLast && (
        <ActionIcon
          size={20}
          variant="light"
          color="#63687C"
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            transform: "translate(50%, -50%)",
            backgroundColor: "white",
            zIndex: 3,
            outline: "none",
          }}
          onClick={onAddAfterLast}
        >
          <IconCirclePlus />
        </ActionIcon>
      )}

      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          width: "100%",
          height: 12,
          backgroundImage:
            "radial-gradient(circle, #63687C 1.5px, transparent 1.5px)",
          backgroundSize: "6px 6px",
          backgroundRepeat: "space",
          borderRadius: 4,
          marginBottom: 8,
          userSelect: "none",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Select
          value={col.fieldPath || null}
          data={fieldOptions}
          onChange={(next) => onFieldChange(col.id, next)}
          onFocus={() => onFocusColumn(col.id)}
          searchable
          allowDeselect
          clearable
          size="xs"
          comboboxProps={{ width: 200, position: "bottom-start" }}
        />
        <NumberInput
          placeholder="幅"
          value={col.width}
          onChange={(next) => onWidthChange(col.id, next)}
          onFocus={() => onFocusColumn(col.id)}
          min={1}
          clampBehavior="strict"
          allowDecimal={false}
          size="xs"
        />
      </div>
    </div>
  );
}

export function useTableSettingDrawer({
  controller,
  extraFieldOptions,
}: UseTableSettingDrawerProps) {
  const {
    schema,
    defaultFieldPaths,
    previewColumns,
    focusedColumnId,
    isPreviewing,
    canSave,
    isSaving,
    openPreview,
    closePreview,
    setPreviewColumns,
    setFocusedColumnId,
    savePreview,
    resetPreviewToDefault,
  } = controller;

  const schemaColumns = useMemo(
    () => extractSchemaColumns(schema, defaultFieldPaths ? { defaultFieldPaths } : undefined),
    [schema, defaultFieldPaths],
  );

  const fieldOptions = useMemo(() => {
    const schemaOptions: { value: string; label: string; group?: string }[] =
      schemaColumns.map((col) => ({
        value: col.fieldPath,
        label: col.label,
      }));

    if (!extraFieldOptions?.length) return schemaOptions;
    return [...schemaOptions, ...extraFieldOptions];
  }, [schemaColumns, extraFieldOptions]);

  const selectData = useMemo(() => toSelectData(fieldOptions), [fieldOptions]);

  const defaultWidthByField = useMemo(() => {
    const acc: Record<string, string> = {};
    for (const col of schemaColumns) {
      acc[col.fieldPath] = String(col.meta.width ?? DEFAULT_WIDTH);
    }
    if (extraFieldOptions) {
      for (const opt of extraFieldOptions) {
        acc[opt.value] = String(opt.width ?? DEFAULT_WIDTH);
      }
    }
    return acc;
  }, [schemaColumns, extraFieldOptions]);

  const schemaDefaultColumns = useMemo<ColumnEntry[]>(
    () =>
      schemaColumns
        .filter((col) => col.isDefault)
        .map((col) => ({
          fieldPath: col.fieldPath,
          width: String(col.meta.width ?? DEFAULT_WIDTH),
          id: col.fieldPath,
        })),
    [schemaColumns],
  );

  const activeColumns = useMemo(() => {
    const source = previewColumns ?? schemaDefaultColumns;
    return ensureIds(source);
  }, [previewColumns, schemaDefaultColumns]);

  const clearFocusedColumnId = useCallback(() => {
    setFocusedColumnId(undefined);
  }, [setFocusedColumnId]);

  const handleOpen = useCallback(() => {
    openPreview();
  }, [openPreview]);

  const handleSave = useCallback(() => {
    void savePreview();
  }, [savePreview]);

  const handleClose = useCallback(() => {
    closePreview();
  }, [closePreview]);

  const handleReset = useCallback(() => {
    resetPreviewToDefault();
  }, [resetPreviewToDefault]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const resolvePreview = useCallback(
    (prev: ColumnEntry[] | null) => ensureIds(prev ?? schemaDefaultColumns),
    [schemaDefaultColumns],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setPreviewColumns((prev) => {
        const cols = resolvePreview(prev);
        const oldIndex = cols.findIndex((c) => c.id === active.id);
        const newIndex = cols.findIndex((c) => c.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(cols, oldIndex, newIndex);
      });
      setFocusedColumnId(String(active.id));
    },
    [setPreviewColumns, resolvePreview, setFocusedColumnId],
  );

  const handleFieldChange = useCallback(
    (id: string, newFieldPath: string | null) => {
      setPreviewColumns((prev) =>
        resolvePreview(prev).map((col) =>
          col.id === id
            ? {
                ...col,
                fieldPath: newFieldPath ?? "",
                width: newFieldPath
                  ? (defaultWidthByField[newFieldPath] ?? String(DEFAULT_WIDTH))
                  : String(DEFAULT_WIDTH),
              }
            : col,
        ),
      );
    },
    [setPreviewColumns, resolvePreview, defaultWidthByField],
  );

  const handleWidthChange = useCallback(
    (id: string, newWidth: string | number) => {
      setPreviewColumns((prev) =>
        resolvePreview(prev).map((col) =>
          col.id === id ? { ...col, width: String(newWidth || "") } : col,
        ),
      );
    },
    [setPreviewColumns, resolvePreview],
  );

  const handleAdd = useCallback(
    (id: string) => {
      const newCol = createEmptyColumn();
      setPreviewColumns((prev) => {
        const cols = resolvePreview(prev);
        const index = cols.findIndex((c) => c.id === id);
        if (index === -1) return prev;
        const next = [...cols];
        next.splice(index, 0, newCol);
        return next;
      });
      setFocusedColumnId(newCol.id);
    },
    [setPreviewColumns, resolvePreview, setFocusedColumnId],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setPreviewColumns((prev) => {
        const cols = resolvePreview(prev);
        if (cols.length <= 1) return prev;
        return cols.filter((col) => col.id !== id);
      });
    },
    [setPreviewColumns, resolvePreview],
  );

  const handleAddAfterLast = useCallback(() => {
    const newCol = createEmptyColumn();
    setPreviewColumns((prev) => [...resolvePreview(prev), newCol]);
    setFocusedColumnId(newCol.id);
  }, [setPreviewColumns, resolvePreview, setFocusedColumnId]);

  const columnIds = useMemo(
    () => activeColumns.map((c) => c.id),
    [activeColumns],
  );

  const modal = (
    <Drawer
      opened={isPreviewing}
      onClose={handleClose}
      title="テーブル設定"
      position="bottom"
      size="240px"
      withOverlay={false}
      lockScroll={false}
      trapFocus={false}
      styles={{
        inner: {
          pointerEvents: "none",
        },
        content: {
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: "auto",
        },
        body: {
          flex: 1,
          overflow: "hidden",
        },
      }}
    >
      <div
        className={COLUMN_FOCUS_ZONE_CLASS}
        style={{ overflowX: "auto", padding: "0 15px 4px" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <div style={{ display: "flex" }}>
              {activeColumns.map((col, index) => (
                <SortableColumn
                  key={col.id}
                  col={col}
                  fieldOptions={selectData}
                  onFieldChange={handleFieldChange}
                  onWidthChange={handleWidthChange}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  canRemove={activeColumns.length > 1}
                  isLast={index === activeColumns.length - 1}
                  onAddAfterLast={handleAddAfterLast}
                  isFocused={col.id === focusedColumnId}
                  onFocusColumn={setFocusedColumnId}
                  onBlurColumn={clearFocusedColumnId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <Group justify="flex-end" mt="sm" px="md">
        <Button size="xs" variant="default" onClick={handleReset}>
          初期設定に戻す
        </Button>
        <Button size="xs" variant="default" onClick={handleClose}>
          破棄
        </Button>
        <Button
          size="xs"
          onClick={handleSave}
          disabled={!canSave}
          loading={isSaving}
        >
          保存
        </Button>
      </Group>
    </Drawer>
  );

  return { open: handleOpen, modal, isPreviewing, focusedColumnId };
}
