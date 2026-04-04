import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import type { ColumnEntry } from "./table-types";

export type ColumnSettingScope = "team" | "user" | "local";

export type StorageScopeOption = {
  value: ColumnSettingScope;
  label: string;
  groupLabel: string;
  disabled?: boolean;
  isDefault?: boolean;
};

export type ColumnSettingRef = {
  type: ColumnSettingScope;
  id: string;
  name: string;
  writable: boolean;
  deletable: boolean;
  label?: string;
  isDefault?: boolean;
};

export type ColumnSettingData = {
  columns: ColumnEntry[] | null;
};

// --- Legacy persistence (backward-compatible) ---

export type ColumnSettingPersistence = {
  loadColumnSetting: (
    setting: ColumnSettingRef,
  ) => Promise<ColumnSettingData | null> | ColumnSettingData | null;
  saveColumnSetting: (
    setting: ColumnSettingRef,
    data: ColumnSettingData,
  ) => Promise<void> | void;
};

// --- Profile store persistence (new CRUD) ---

export type CreateColumnSettingInput = {
  type: ColumnSettingScope;
  name: string;
  columns: ColumnEntry[] | null;
};

export type ColumnSettingProfilePersistence = {
  listColumnSettings: () => Promise<ColumnSettingRef[]>;
  loadColumnSetting: (
    id: string,
  ) => Promise<ColumnSettingData | null>;
  createColumnSetting: (
    input: CreateColumnSettingInput,
  ) => Promise<ColumnSettingRef>;
  updateColumnSetting: (
    id: string,
    input: { name?: string; columns?: ColumnEntry[] | null },
  ) => Promise<void>;
  deleteColumnSetting: (id: string) => Promise<void>;
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
  isLoadingList: boolean;
  isSaving: boolean;
  canSave: boolean;
  hasDirtyPreview: boolean;
  hasProfileStore: boolean;
  storageScopeOptions: StorageScopeOption[];
  openPreview: () => void;
  closePreview: () => void;
  setPreviewColumns: SetPreviewColumns;
  setFocusedColumnId: (columnId: string | undefined) => void;
  selectColumnSetting: (setting: ColumnSettingRef | null) => Promise<void>;
  reloadCurrent: () => Promise<void>;
  reloadColumnSettings: () => Promise<void>;
  savePreview: () => Promise<void>;
  savePreviewAs: (
    name: string,
    targetType: ColumnSettingScope,
  ) => Promise<void>;
  renameCurrent: (name: string) => Promise<void>;
  deleteCurrent: () => Promise<void>;
  discardPreview: () => void;
};

// --- Legacy props (backward-compatible) ---

export type UseColumnSettingsControllerProps<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  schema: T;
  defaultFieldPaths?: string[];
  columnSettings: ColumnSettingRef[];
  initialSetting?: ColumnSettingRef | null;
  persistence: ColumnSettingPersistence;
};

// --- Profile-aware props (new) ---

export type UseColumnSettingsProfileControllerProps<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  schema: T;
  defaultFieldPaths?: string[];
  initialSettingId?: string | null;
  profilePersistence: ColumnSettingProfilePersistence;
  storageScopeOptions?: StorageScopeOption[];
};

// ---------------------------------------------------------------------------
// Legacy controller (backward-compatible)
// ---------------------------------------------------------------------------

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
    if (previewColumns == null) {
      setPreviewColumnsRaw(persistedColumns);
    }
    setFocusedColumnId(undefined);
    setIsPreviewing(true);
  }, [persistedColumns, previewColumns]);

  const closePreview = useCallback(() => {
    setFocusedColumnId(undefined);
    setIsPreviewing(false);
  }, []);

  const selectColumnSetting = useCallback(
    async (setting: ColumnSettingRef | null) => {
      setCurrentColumnSetting(setting);
      if (setting) {
        await loadSetting(setting);
      } else {
        setPersistedColumns(null);
      }
      setPreviewColumnsRaw(null);
    },
    [loadSetting],
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
    } finally {
      setIsSaving(false);
    }
  }, [currentColumnSetting, previewColumns]);

  const discardPreview = useCallback(() => {
    setPreviewColumnsRaw(null);
    setFocusedColumnId(undefined);
  }, []);

  const hasDirtyPreview = previewColumns != null;

  const canSave = useMemo(
    () =>
      hasDirtyPreview &&
      currentColumnSetting != null &&
      currentColumnSetting.writable &&
      !isSaving,
    [hasDirtyPreview, currentColumnSetting, isSaving],
  );

  const noop = useCallback(async () => {}, []);
  const noopWithArgs = useCallback(async (_a: string, _b?: ColumnSettingScope) => {}, []);

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
      isLoadingList: false,
      isSaving,
      canSave,
      hasDirtyPreview,
      hasProfileStore: false,
      storageScopeOptions: [],
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      reloadColumnSettings: noop,
      savePreview,
      savePreviewAs: noopWithArgs,
      renameCurrent: noop,
      deleteCurrent: noop,
      discardPreview,
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
      hasDirtyPreview,
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      noop,
      savePreview,
      noopWithArgs,
      discardPreview,
    ],
  );
}

// ---------------------------------------------------------------------------
// Profile-aware controller (new)
// ---------------------------------------------------------------------------

export function useColumnSettingsProfileController<T extends z.ZodTypeAny = z.ZodTypeAny>({
  schema,
  defaultFieldPaths,
  initialSettingId,
  profilePersistence,
  storageScopeOptions: storageScopeOptionsProp,
}: UseColumnSettingsProfileControllerProps<T>): ColumnSettingsController<T> {
  const storageScopeOptions = storageScopeOptionsProp ?? [];
  const [columnSettings, setColumnSettings] = useState<ColumnSettingRef[]>([]);
  const [currentColumnSetting, setCurrentColumnSetting] =
    useState<ColumnSettingRef | null>(null);
  const [persistedColumns, setPersistedColumns] = useState<ColumnEntry[] | null>(null);
  const [previewColumns, setPreviewColumnsRaw] = useState<ColumnEntry[] | null>(null);
  const [focusedColumnId, setFocusedColumnId] = useState<string | undefined>(undefined);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const persistenceRef = useRef(profilePersistence);
  persistenceRef.current = profilePersistence;

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      return await persistenceRef.current.listColumnSettings();
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadColumns = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const data = await persistenceRef.current.loadColumnSetting(id);
      setPersistedColumns(data?.columns ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    void (async () => {
      const list = await loadList();
      setColumnSettings(list);

      if (initialSettingId) {
        const initial = list.find((s) => s.id === initialSettingId);
        if (initial) {
          setCurrentColumnSetting(initial);
          await loadColumns(initial.id);
        }
      }
    })();
  }, [loadList, loadColumns, initialSettingId]);

  const setPreviewColumns: SetPreviewColumns = useCallback((value) => {
    setPreviewColumnsRaw((prev) =>
      typeof value === "function" ? value(prev) : value,
    );
  }, []);

  const openPreview = useCallback(() => {
    if (previewColumns == null) {
      setPreviewColumnsRaw(persistedColumns);
    }
    setFocusedColumnId(undefined);
    setIsPreviewing(true);
  }, [persistedColumns, previewColumns]);

  const closePreview = useCallback(() => {
    setFocusedColumnId(undefined);
    setIsPreviewing(false);
  }, []);

  const selectColumnSetting = useCallback(
    async (setting: ColumnSettingRef | null) => {
      setCurrentColumnSetting(setting);
      if (setting) {
        await loadColumns(setting.id);
      } else {
        setPersistedColumns(null);
      }
      setPreviewColumnsRaw(null);
    },
    [loadColumns],
  );

  const reloadCurrent = useCallback(async () => {
    if (currentColumnSetting) {
      await loadColumns(currentColumnSetting.id);
    }
  }, [currentColumnSetting, loadColumns]);

  const reloadColumnSettings = useCallback(async () => {
    const list = await loadList();
    setColumnSettings(list);
  }, [loadList]);

  const savePreview = useCallback(async () => {
    if (!currentColumnSetting || !currentColumnSetting.writable) return;
    setIsSaving(true);
    try {
      await persistenceRef.current.updateColumnSetting(currentColumnSetting.id, {
        columns: previewColumns,
      });
      setPersistedColumns(previewColumns);
      setPreviewColumnsRaw(null);
      setFocusedColumnId(undefined);
    } finally {
      setIsSaving(false);
    }
  }, [currentColumnSetting, previewColumns]);

  const savePreviewAs = useCallback(
    async (name: string, targetType: ColumnSettingScope) => {
      setIsSaving(true);
      try {
        const sourceColumns = previewColumns ?? persistedColumns;
        const created = await persistenceRef.current.createColumnSetting({
          type: targetType,
          name,
          columns: sourceColumns,
        });
        const list = await loadList();
        setColumnSettings(list);
        setCurrentColumnSetting(created);
        setPersistedColumns(sourceColumns);
        setPreviewColumnsRaw(null);
        setFocusedColumnId(undefined);
      } finally {
        setIsSaving(false);
      }
    },
    [previewColumns, persistedColumns, loadList],
  );

  const renameCurrent = useCallback(
    async (name: string) => {
      if (!currentColumnSetting || !currentColumnSetting.writable) return;
      setIsSaving(true);
      try {
        await persistenceRef.current.updateColumnSetting(currentColumnSetting.id, { name });
        const updated: ColumnSettingRef = { ...currentColumnSetting, name };
        setCurrentColumnSetting(updated);
        setColumnSettings((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [currentColumnSetting],
  );

  const deleteCurrent = useCallback(async () => {
    if (!currentColumnSetting || !currentColumnSetting.deletable) return;
    setIsSaving(true);
    try {
      await persistenceRef.current.deleteColumnSetting(currentColumnSetting.id);
      const list = await loadList();
      setColumnSettings(list);
      setCurrentColumnSetting(null);
      setPersistedColumns(null);
      setPreviewColumnsRaw(null);
      setFocusedColumnId(undefined);
    } finally {
      setIsSaving(false);
    }
  }, [currentColumnSetting, loadList]);

  const discardPreview = useCallback(() => {
    setPreviewColumnsRaw(null);
    setFocusedColumnId(undefined);
  }, []);

  const hasDirtyPreview = previewColumns != null;

  const canSave = useMemo(
    () =>
      hasDirtyPreview &&
      currentColumnSetting != null &&
      currentColumnSetting.writable &&
      !isSaving,
    [hasDirtyPreview, currentColumnSetting, isSaving],
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
      isLoadingList,
      isSaving,
      canSave,
      hasDirtyPreview,
      hasProfileStore: true,
      storageScopeOptions,
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      reloadColumnSettings,
      savePreview,
      savePreviewAs,
      renameCurrent,
      deleteCurrent,
      discardPreview,
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
      isLoadingList,
      isSaving,
      canSave,
      hasDirtyPreview,
      storageScopeOptions,
      openPreview,
      closePreview,
      setPreviewColumns,
      setFocusedColumnId,
      selectColumnSetting,
      reloadCurrent,
      reloadColumnSettings,
      savePreview,
      savePreviewAs,
      renameCurrent,
      deleteCurrent,
      discardPreview,
    ],
  );
}
