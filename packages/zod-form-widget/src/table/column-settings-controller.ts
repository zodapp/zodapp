import { useCallback, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import type { ColumnEntry } from "./table-types";

export type ColumnSettingScope = "team" | "user" | "local";

export type ColumnSettingRef = {
  type: ColumnSettingScope;
  id: string;
  writable: boolean;
  label?: string;
};

export type ColumnSettingData = {
  columns: ColumnEntry[] | null;
};

export type ColumnSettingPersistence = {
  loadColumnSetting: (
    setting: ColumnSettingRef,
  ) => Promise<ColumnSettingData | null> | ColumnSettingData | null;
  saveColumnSetting: (
    setting: ColumnSettingRef,
    data: ColumnSettingData,
  ) => Promise<void> | void;
};

export type SetPreviewColumns = (
  value:
    | ColumnEntry[]
    | null
    | ((prev: ColumnEntry[] | null) => ColumnEntry[] | null),
) => void;

export type ColumnSettingsController<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  schema: T;
  defaultFieldPaths?: string[];
  columnSettings: ColumnSettingRef[];
  currentColumnSetting: ColumnSettingRef | null;
  persistedColumns: ColumnEntry[] | null;
  previewColumns: ColumnEntry[] | null;
  focusedColumnId: string | undefined;
  isPreviewing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  canSave: boolean;
  openPreview: () => void;
  closePreview: () => void;
  setPreviewColumns: SetPreviewColumns;
  setFocusedColumnId: (columnId: string | undefined) => void;
  selectColumnSetting: (setting: ColumnSettingRef) => Promise<void>;
  reloadCurrent: () => Promise<void>;
  savePreview: () => Promise<void>;
  resetPreviewToDefault: () => void;
};

export type UseColumnSettingsControllerProps<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  schema: T;
  defaultFieldPaths?: string[];
  columnSettings: ColumnSettingRef[];
  initialSetting?: ColumnSettingRef | null;
  persistence: ColumnSettingPersistence;
};

export function useColumnSettingsController<T extends z.ZodTypeAny = z.ZodTypeAny>({
  schema,
  defaultFieldPaths,
  columnSettings,
  initialSetting,
  persistence,
}: UseColumnSettingsControllerProps<T>): ColumnSettingsController<T> {
  const [currentColumnSetting, setCurrentColumnSetting] =
    useState<ColumnSettingRef | null>(
      initialSetting ?? columnSettings[0] ?? null,
    );
  const [persistedColumns, setPersistedColumns] = useState<
    ColumnEntry[] | null
  >(null);
  const [previewColumns, setPreviewColumnsRaw] = useState<ColumnEntry[] | null>(
    null,
  );
  const [focusedColumnId, setFocusedColumnId] = useState<string | undefined>(
    undefined,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;

  const loadSetting = useCallback(async (setting: ColumnSettingRef) => {
    setIsLoading(true);
    try {
      const data = await persistenceRef.current.loadColumnSetting(setting);
      setPersistedColumns(data?.columns ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initialLoadDone = useRef(false);
  if (!initialLoadDone.current && currentColumnSetting) {
    initialLoadDone.current = true;
    void loadSetting(currentColumnSetting);
  }

  const setPreviewColumns: SetPreviewColumns = useCallback((value) => {
    setPreviewColumnsRaw((prev) =>
      typeof value === "function" ? value(prev) : value,
    );
  }, []);

  const openPreview = useCallback(() => {
    setPreviewColumnsRaw(persistedColumns);
    setFocusedColumnId(undefined);
    setIsPreviewing(true);
  }, [persistedColumns]);

  const closePreview = useCallback(() => {
    setPreviewColumnsRaw(null);
    setFocusedColumnId(undefined);
    setIsPreviewing(false);
  }, []);

  const selectColumnSetting = useCallback(
    async (setting: ColumnSettingRef) => {
      setCurrentColumnSetting(setting);
      await loadSetting(setting);
      if (isPreviewing) {
        setPreviewColumnsRaw(null);
      }
    },
    [loadSetting, isPreviewing],
  );

  const reloadCurrent = useCallback(async () => {
    if (currentColumnSetting) {
      await loadSetting(currentColumnSetting);
    }
  }, [currentColumnSetting, loadSetting]);

  const savePreview = useCallback(async () => {
    if (!currentColumnSetting || !currentColumnSetting.writable) return;
    setIsSaving(true);
    try {
      await persistenceRef.current.saveColumnSetting(currentColumnSetting, {
        columns: previewColumns,
      });
      setPersistedColumns(previewColumns);
      setPreviewColumnsRaw(null);
      setFocusedColumnId(undefined);
      setIsPreviewing(false);
    } finally {
      setIsSaving(false);
    }
  }, [currentColumnSetting, previewColumns]);

  const resetPreviewToDefault = useCallback(() => {
    setPreviewColumnsRaw(null);
    setFocusedColumnId(undefined);
  }, []);

  const canSave = useMemo(
    () =>
      isPreviewing &&
      currentColumnSetting != null &&
      currentColumnSetting.writable &&
      !isSaving,
    [isPreviewing, currentColumnSetting, isSaving],
  );

  return useMemo<ColumnSettingsController<T>>(
    () => ({
      schema,
      defaultFieldPaths,
      columnSettings,
      currentColumnSetting,
      persistedColumns,
      previewColumns,
      focusedColumnId,
      isPreviewing,
      isLoading,
      isSaving,
      canSave,
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      savePreview,
      resetPreviewToDefault,
    }),
    [
      schema,
      defaultFieldPaths,
      columnSettings,
      currentColumnSetting,
      persistedColumns,
      previewColumns,
      focusedColumnId,
      isPreviewing,
      isLoading,
      isSaving,
      canSave,
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      savePreview,
      resetPreviewToDefault,
    ],
  );
}
