import { useCallback } from 'react';
import type { ColumnEntry } from './table-types';
import { useLocalStorageState, useSessionStorageState } from './useStorageState';

type SessionStorageData = {
  columns: ColumnEntry[] | null;
  focusedColumnId?: string;
};

type SetPreviewColumns = (
  value: ColumnEntry[] | null | ((prev: ColumnEntry[] | null) => ColumnEntry[] | null)
) => void;

type UseColumnStorageResult = {
  columns: ColumnEntry[] | null;
  setPreviewColumns: SetPreviewColumns;
  focusedColumnId: string | undefined;
  setFocusedColumnId: (columnId: string | undefined) => void;
};

const EMPTY_SESSION: SessionStorageData = { columns: null };

export function useColumnStorage(
  storageKey: string | undefined,
  isPreviewing: boolean
): UseColumnStorageResult {
  const persistKey = storageKey ?? '';
  const previewKey = storageKey ? `${storageKey}-preview` : '';
  const [persistedColumns] = useLocalStorageState<ColumnEntry[] | null>(persistKey, null);
  const [sessionData, setSessionData] = useSessionStorageState<SessionStorageData>(
    previewKey,
    EMPTY_SESSION
  );

  const setPreviewColumns: SetPreviewColumns = useCallback(
    (value) => {
      setSessionData((prev) => {
        const prevColumns = prev.columns;
        const nextColumns = typeof value === 'function' ? value(prevColumns) : value;
        return { ...prev, columns: nextColumns };
      });
    },
    [setSessionData]
  );

  const setFocusedColumnId = useCallback(
    (columnId: string | undefined) => {
      setSessionData((prev) => ({ ...prev, focusedColumnId: columnId }));
    },
    [setSessionData]
  );

  const noopSetPreviewColumns: SetPreviewColumns = useCallback(() => {}, []);
  const noopSetFocusedColumnId = useCallback(() => {}, []);

  if (!storageKey)
    return {
      columns: null,
      setPreviewColumns: noopSetPreviewColumns,
      focusedColumnId: undefined,
      setFocusedColumnId: noopSetFocusedColumnId
    };

  return {
    columns: isPreviewing ? sessionData.columns : persistedColumns,
    setPreviewColumns,
    focusedColumnId: sessionData.focusedColumnId,
    setFocusedColumnId
  };
}
