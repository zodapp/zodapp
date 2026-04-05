import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowBackUp,
  IconCircleMinus,
  IconCirclePlus,
  IconTrash,
} from "@tabler/icons-react";
import { COLUMN_FOCUS_ZONE_CLASS } from "./AutoTable";
import { type ColumnEntry } from "./table-types";
import { extractSchemaColumns } from "./extract-schema-columns";
import type {
  ColumnSettingsController,
  ColumnSettingScope,
} from "./column-settings-controller";
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

// ---------------------------------------------------------------------------
// SortableColumn (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// useTableSettingDrawer
// ---------------------------------------------------------------------------

export function useTableSettingDrawer({
  controller,
  extraFieldOptions,
}: UseTableSettingDrawerProps) {
  const {
    schema,
    defaultFieldPaths,
    columnSettings,
    currentColumnSetting,
    persistedColumns,
    previewColumns,
    focusedColumnId,
    isPreviewing,
    canSave,
    isSaving,
    hasDirtyPreview,
    hasProfileStore,
    storageScopeOptions: scopeOptions,
    openPreview,
    closePreview,
    setPreviewColumns,
    setFocusedColumnId,
    savePreview,
    savePreviewAs,
    deleteCurrent,
    selectColumnSetting,
    discardPreview,
  } = controller;

  const resolveScopeGroupLabel = useCallback(
    (scope: ColumnSettingScope | undefined): string =>
      scopeOptions.find((o) => o.value === scope)?.groupLabel ?? "その他",
    [scopeOptions],
  );

  // --- schema columns ---
  const schemaColumns = useMemo(
    () =>
      extractSchemaColumns(
        schema,
        defaultFieldPaths ? { defaultFieldPaths } : undefined,
      ),
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
    const source = previewColumns ?? persistedColumns ?? schemaDefaultColumns;
    return ensureIds(source);
  }, [previewColumns, persistedColumns, schemaDefaultColumns]);

  const clearFocusedColumnId = useCallback(() => {
    setFocusedColumnId(undefined);
  }, [setFocusedColumnId]);

  const handleOpen = useCallback(() => {
    openPreview();
  }, [openPreview]);

  const handleClose = useCallback(() => {
    closePreview();
  }, [closePreview]);

  const handleDiscard = useCallback(() => {
    discardPreview();
  }, [discardPreview]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const resolvePreview = useCallback(
    (prev: ColumnEntry[] | null) =>
      ensureIds(prev ?? persistedColumns ?? schemaDefaultColumns),
    [persistedColumns, schemaDefaultColumns],
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

  // --- Profile select data (with virtual "default" entry, grouped by scope) ---
  const DEFAULT_PROFILE_ID = "__default__";

  const profileSelectData = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const s of columnSettings) {
      const group = resolveScopeGroupLabel(s.type);
      let items = groups.get(group);
      if (!items) {
        items = [];
        groups.set(group, items);
      }
      items.push({ value: s.id, label: s.name || s.label || s.id });
    }

    const result: (
      | { value: string; label: string }
      | { group: string; items: { value: string; label: string }[] }
    )[] = [{ value: DEFAULT_PROFILE_ID, label: "デフォルト" }];
    for (const [group, items] of groups) {
      result.push({ group, items });
    }
    return result;
  }, [columnSettings, resolveScopeGroupLabel]);

  const isDefaultSelected = currentColumnSetting == null;

  const handleProfileSelect = useCallback(
    (value: string | null) => {
      if (!value) return;
      if (value === DEFAULT_PROFILE_ID) {
        if (!isDefaultSelected) void selectColumnSetting(null);
        return;
      }
      if (value === currentColumnSetting?.id) return;
      const setting = columnSettings.find((s) => s.id === value);
      if (setting) {
        void selectColumnSetting(setting);
      }
    },
    [columnSettings, selectColumnSetting, isDefaultSelected, currentColumnSetting?.id],
  );

  // --- Save confirm modal ---
  const [saveConfirmOpened, saveConfirmHandlers] = useDisclosure(false);

  const handleSaveClick = useCallback(() => {
    if (!currentColumnSetting) return;
    if (hasProfileStore) {
      saveConfirmHandlers.open();
    } else {
      void savePreview();
    }
  }, [currentColumnSetting, hasProfileStore, saveConfirmHandlers, savePreview]);

  const handleSaveConfirm = useCallback(() => {
    saveConfirmHandlers.close();
    void savePreview();
  }, [saveConfirmHandlers, savePreview]);

  // --- Save As modal ---
  const defaultScopeValue =
    scopeOptions.find((o) => o.isDefault)?.value ??
    scopeOptions.find((o) => !o.disabled)?.value ??
    scopeOptions[0]?.value;

  const [saveAsOpened, saveAsHandlers] = useDisclosure(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsScope, setSaveAsScope] = useState<
    ColumnSettingScope | undefined
  >(defaultScopeValue);

  const openSaveAs = useCallback(() => {
    setSaveAsName("");
    setSaveAsScope(defaultScopeValue);
    saveAsHandlers.open();
  }, [saveAsHandlers, defaultScopeValue]);

  const handleSaveAsConfirm = useCallback(() => {
    if (!saveAsName.trim() || !saveAsScope) return;
    saveAsHandlers.close();
    void savePreviewAs(saveAsName.trim(), saveAsScope);
  }, [saveAsName, saveAsScope, saveAsHandlers, savePreviewAs]);

  // --- Delete confirm modal ---
  const [deleteConfirmOpened, deleteConfirmHandlers] = useDisclosure(false);

  const handleDeleteClick = useCallback(() => {
    deleteConfirmHandlers.open();
  }, [deleteConfirmHandlers]);

  const handleDeleteConfirm = useCallback(() => {
    deleteConfirmHandlers.close();
    void deleteCurrent();
  }, [deleteConfirmHandlers, deleteCurrent]);

  // --- Drawer ---

  const modal = (
    <>
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
        <Group gap="xs" px="md" mb="xs" wrap="nowrap">
          {hasProfileStore && (
            <>
              <Select
                size="xs"
                value={
                  isDefaultSelected
                    ? DEFAULT_PROFILE_ID
                    : (currentColumnSetting?.id ?? null)
                }
                data={profileSelectData}
                onChange={handleProfileSelect}
                style={{ flex: 1, maxWidth: 240 }}
              />
              {!isDefaultSelected && currentColumnSetting && (
                <Badge size="sm" variant="light" color="gray">
                  {resolveScopeGroupLabel(currentColumnSetting.type)}
                </Badge>
              )}
              {hasDirtyPreview && (
                <>
                  <Badge size="sm" variant="light" color="orange">
                    編集中
                  </Badge>
                  <Tooltip label="編集を破棄" position="bottom" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={handleDiscard}
                    >
                      <IconArrowBackUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              {!isDefaultSelected && currentColumnSetting?.deletable ? (
                <Tooltip label="プロフィールを削除" position="bottom" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={handleDeleteClick}
                    disabled={isSaving}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Badge size="sm" variant="light" color="gray">
                  読み込み専用
                </Badge>
              )}
            </>
          )}
          <div style={{ flex: 1 }} />
          {hasProfileStore && (
            <Button
              size="xs"
              variant="default"
              onClick={openSaveAs}
              disabled={isSaving}
            >
              別名で保存
            </Button>
          )}
          {(!hasProfileStore ||
            (!isDefaultSelected && currentColumnSetting?.writable)) && (
            <Button
              size="xs"
              onClick={handleSaveClick}
              disabled={!canSave}
              loading={isSaving}
            >
              上書き保存
            </Button>
          )}
        </Group>

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
      </Drawer>

      {/* Save confirm modal */}
      <Modal
        opened={saveConfirmOpened}
        onClose={saveConfirmHandlers.close}
        title="保存の確認"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">
            {resolveScopeGroupLabel(currentColumnSetting?.type)}の設定「
            {currentColumnSetting?.name}」に上書き保存しますか？
          </Text>
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="default"
              onClick={saveConfirmHandlers.close}
            >
              キャンセル
            </Button>
            <Button size="xs" onClick={handleSaveConfirm} loading={isSaving}>
              上書き保存
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Save As modal */}
      <Modal
        opened={saveAsOpened}
        onClose={saveAsHandlers.close}
        title="別名で保存"
        centered
        size="sm"
      >
        <Stack>
          <TextInput
            label="プロフィール名"
            placeholder="名前を入力"
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.currentTarget.value)}
            size="sm"
          />
          <Radio.Group
            label="保存先"
            value={saveAsScope}
            onChange={(v) => setSaveAsScope(v as ColumnSettingScope)}
          >
            <Stack gap="xs" mt={4}>
              {scopeOptions.map((opt) => (
                <Radio
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  disabled={opt.disabled}
                  size="sm"
                  style={{
                    "--radio-color": "var(--mantine-primary-color-filled)",
                  }}
                />
              ))}
            </Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button size="xs" variant="default" onClick={saveAsHandlers.close}>
              キャンセル
            </Button>
            <Button
              size="xs"
              onClick={handleSaveAsConfirm}
              disabled={!saveAsName.trim()}
              loading={isSaving}
            >
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        opened={deleteConfirmOpened}
        onClose={deleteConfirmHandlers.close}
        title="削除の確認"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">
            {resolveScopeGroupLabel(currentColumnSetting?.type)}の設定「
            {currentColumnSetting?.name}
            」を削除しますか？この操作は取り消せません。
          </Text>
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="default"
              onClick={deleteConfirmHandlers.close}
            >
              キャンセル
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={handleDeleteConfirm}
              loading={isSaving}
            >
              削除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );

  return {
    open: handleOpen,
    close: handleClose,
    modal,
    isPreviewing,
    hasDirtyPreview,
    focusedColumnId,
  };
}
