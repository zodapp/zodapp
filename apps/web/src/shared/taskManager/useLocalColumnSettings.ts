import { useMemo, useCallback } from "react";
import type { z } from "zod";
import {
  useColumnSettingsController,
  useLocalStorageState,
  type ColumnSettingRef,
  type ColumnSettingData,
  type ColumnSettingsController,
  type ColumnEntry,
} from "@zodapp/zod-form-widget/table";

export type UseLocalColumnSettingsProps<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  storageKey: string;
  schema: T;
  defaultFieldPaths?: string[];
};

export function useLocalColumnSettings<T extends z.ZodTypeAny = z.ZodTypeAny>({
  storageKey,
  schema,
  defaultFieldPaths,
}: UseLocalColumnSettingsProps<T>): ColumnSettingsController<T> {
  const settingRef = useMemo<ColumnSettingRef>(
    () => ({
      type: "local" as const,
      id: storageKey,
      writable: true,
      label: "このブラウザ",
    }),
    [storageKey],
  );

  const columnSettings = useMemo(() => [settingRef], [settingRef]);

  const [storedColumns, setStoredColumns] = useLocalStorageState<
    ColumnEntry[] | null
  >(storageKey, null);

  const loadColumnSetting = useCallback(
    (_setting: ColumnSettingRef): ColumnSettingData | null => {
      return storedColumns != null ? { columns: storedColumns } : null;
    },
    [storedColumns],
  );

  const saveColumnSetting = useCallback(
    (_setting: ColumnSettingRef, data: ColumnSettingData) => {
      setStoredColumns(data.columns);
    },
    [setStoredColumns],
  );

  const persistence = useMemo(
    () => ({ loadColumnSetting, saveColumnSetting }),
    [loadColumnSetting, saveColumnSetting],
  );

  return useColumnSettingsController({
    schema,
    defaultFieldPaths,
    columnSettings,
    initialSetting: settingRef,
    persistence,
  });
}
