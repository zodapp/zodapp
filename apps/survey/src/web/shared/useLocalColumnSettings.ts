import { useMemo } from "react";
import type { z } from "zod";
import {
  useColumnSettingsController,
  type ColumnSettingData,
  type ColumnSettingPersistence,
  type ColumnSettingRef,
  type ColumnSettingsController,
} from "@zodapp/zod-form-widget/table";

/**
 * 列設定を、このブラウザ（localStorage）にだけ保存する。
 *
 * taskmanager は列設定のプロファイルを DynamoDB に保存する（個人・ワークスペース共通）。
 * このサンプルは表を動的なスキーマで作ることが主題なので、保存先は localStorage だけにする。
 */
export type UseLocalColumnSettingsProps<T extends z.ZodTypeAny> = {
  /** 表の識別子。localStorage のキーになる */
  tableKey: string;
  schema: T;
  defaultFieldPaths?: string[];
};

const storageKeyOf = (tableKey: string) => `survey:columns:${tableKey}`;

const persistence: ColumnSettingPersistence = {
  loadColumnSetting: (setting) => {
    try {
      const raw = localStorage.getItem(storageKeyOf(setting.id));
      return raw ? (JSON.parse(raw) as ColumnSettingData) : null;
    } catch {
      return null;
    }
  },
  saveColumnSetting: (setting, data) => {
    try {
      localStorage.setItem(storageKeyOf(setting.id), JSON.stringify(data));
    } catch {
      // プライベートウィンドウなどで保存できなくても、表示はそのまま続ける
    }
  },
};

export const useLocalColumnSettings = <T extends z.ZodTypeAny>({
  tableKey,
  schema,
  defaultFieldPaths,
}: UseLocalColumnSettingsProps<T>): ColumnSettingsController<T> => {
  const columnSettings = useMemo<ColumnSettingRef[]>(
    () => [
      {
        type: "local",
        id: tableKey,
        name: "このブラウザ",
        writable: true,
        deletable: false,
        isDefault: true,
      },
    ],
    [tableKey],
  );
  return useColumnSettingsController({
    schema,
    defaultFieldPaths,
    columnSettings,
    persistence,
  });
};
