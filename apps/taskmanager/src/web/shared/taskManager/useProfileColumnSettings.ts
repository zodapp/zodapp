import { useEffect, useMemo, useRef } from "react";
import type { z } from "zod";
import { useApi } from "@zodapp/zod-dynamodb-react";
import { useLocalStorageState } from "@zodapp/react-storage";
import {
  useColumnSettingsProfileController,
  type ColumnEntry,
  type ColumnSettingProfilePersistence,
  type ColumnSettingRef,
  type ColumnSettingScope,
  type ColumnSettingsController,
  type StorageScopeOption,
} from "@zodapp/zod-form-widget/table";

import { useAuthContext } from "../auth";
import type { Api } from "../api";
import { fetchAllPages } from "../listing";

// =====================================================================
// 列設定プロファイルの 3 スコープ永続化
//   - local: このブラウザ（localStorage）
//   - user : 個人（DynamoDB：scope = "user", ownerId = 利用者）
//   - team : ワークスペース共通（DynamoDB：scope = "team", ownerId = ワークスペース）
// useColumnSettingsProfileController に ColumnSettingProfilePersistence の
// 実装を注入する、プロファイル永続化の参照実装。
// =====================================================================

type LocalProfileRecord = Record<
  string,
  { name: string; columns: ColumnEntry[] | null }
>;

// プロファイル ID はスコープ接頭辞付き（"local:xxx" / "user:xxx" / "team:xxx"）
// で名前空間を分離する
const makeScopedId = (scope: ColumnSettingScope, id: string) =>
  `${scope}:${id}`;
const parseScopedId = (
  scopedId: string,
): { scope: ColumnSettingScope; id: string } => {
  const index = scopedId.indexOf(":");
  return {
    scope: scopedId.slice(0, index) as ColumnSettingScope,
    id: scopedId.slice(index + 1),
  };
};

// 列の項目のうち、保存するもの（id / width / fieldPath）だけを残す
const sanitizeColumns = (
  columns: ColumnEntry[] | null,
): ColumnEntry[] | null =>
  columns
    ? columns.map(({ id, fieldPath, width }) => ({
        id,
        width,
        ...(fieldPath !== undefined ? { fieldPath } : {}),
      }))
    : null;

export type UseProfileColumnSettingsProps<
  T extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  /** テーブル識別子（例: "task"）。スコープをまたいだ絞り込みに使う */
  tableKey: string;
  schema: T;
  defaultFieldPaths?: string[];
  /** ワークスペース共通スコープを使う場合に指定 */
  workspaceId?: string;
};

export function useProfileColumnSettings<
  T extends z.ZodTypeAny = z.ZodTypeAny,
>({
  tableKey,
  schema,
  defaultFieldPaths,
  workspaceId,
}: UseProfileColumnSettingsProps<T>): ColumnSettingsController<T> {
  const { user } = useAuthContext();
  const api = useApi<Api>();
  const userId = user?.uid;

  // local スコープの保存先（localStorage）
  const [localProfiles, setLocalProfiles] =
    useLocalStorageState<LocalProfileRecord>(
      `columnProfiles:${tableKey}`,
      {},
    );
  const localProfilesRef = useRef(localProfiles);
  localProfilesRef.current = localProfiles;

  // 前回選択していたプロファイルを記憶する
  const [selectedId, setSelectedId] = useLocalStorageState<string | null>(
    `columnProfiles:${tableKey}:selected`,
    null,
  );

  // 個人とワークスペース共通は、同じ Table定義の scope と ownerId で分ける
  const ownerOf = useMemo(
    () => (scope: "user" | "team") => {
      const ownerId = scope === "user" ? userId : workspaceId;
      return ownerId ? { scope, ownerId } : undefined;
    },
    [userId, workspaceId],
  );

  const profilePersistence = useMemo<ColumnSettingProfilePersistence>(() => {
    const toRef = (
      scope: ColumnSettingScope,
      id: string,
      name: string,
    ): ColumnSettingRef => ({
      type: scope,
      id: makeScopedId(scope, id),
      name,
      writable: true,
      deletable: true,
    });

    return {
      listColumnSettings: async () => {
        const refs: ColumnSettingRef[] = Object.entries(
          localProfilesRef.current,
        ).map(([id, profile]) => toRef("local", id, profile.name));

        for (const scope of ["user", "team"] as const) {
          const owner = ownerOf(scope);
          if (!owner) continue;
          const docs = await fetchAllPages(
            api.columnSettings.byTable.pages({ ...owner, tableKey }),
          );
          refs.push(...docs.map((doc) => toRef(scope, doc.settingId, doc.name)));
        }
        return refs;
      },

      loadColumnSetting: async (scopedId) => {
        const { scope, id } = parseScopedId(scopedId);
        if (scope === "local") {
          const profile = localProfilesRef.current[id];
          return profile ? { columns: profile.columns } : null;
        }
        const owner = ownerOf(scope);
        if (!owner) return null;
        const doc = await api.columnSettings.get({
          ...owner,
          tableKey,
          settingId: id,
        });
        return doc ? { columns: doc.columns ?? null } : null;
      },

      createColumnSetting: async ({ type, name, columns }) => {
        const sanitized = sanitizeColumns(columns);
        if (type === "local") {
          const id = crypto.randomUUID();
          setLocalProfiles({
            ...localProfilesRef.current,
            [id]: { name, columns: sanitized },
          });
          return toRef("local", id, name);
        }
        const owner = ownerOf(type);
        if (!owner) {
          throw new Error(
            type === "user" ? "ログインが必要です" : "ワークスペース外では保存できません",
          );
        }
        const created = await api.columnSettings.create(
          { ...owner, tableKey },
          { name, columns: sanitized },
        );
        return toRef(type, created.settingId, name);
      },

      updateColumnSetting: async (scopedId, input) => {
        const { scope, id } = parseScopedId(scopedId);
        if (scope === "local") {
          const current = localProfilesRef.current[id];
          if (!current) return;
          setLocalProfiles({
            ...localProfilesRef.current,
            [id]: {
              name: input.name ?? current.name,
              columns:
                input.columns !== undefined
                  ? sanitizeColumns(input.columns)
                  : current.columns,
            },
          });
          return;
        }
        const data = {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.columns !== undefined
            ? { columns: sanitizeColumns(input.columns) }
            : {}),
        };
        const owner = ownerOf(scope);
        if (!owner) return;
        await api.columnSettings.update(
          { ...owner, tableKey, settingId: id },
          data,
        );
      },

      deleteColumnSetting: async (scopedId) => {
        const { scope, id } = parseScopedId(scopedId);
        if (scope === "local") {
          const next = { ...localProfilesRef.current };
          delete next[id];
          setLocalProfiles(next);
          return;
        }
        const owner = ownerOf(scope);
        if (!owner) return;
        await api.columnSettings.remove({ ...owner, tableKey, settingId: id });
      },
    };
  }, [
    tableKey,
    api,
    ownerOf,
    setLocalProfiles,
  ]);

  const storageScopeOptions = useMemo<StorageScopeOption[]>(
    () => [
      {
        value: "local",
        label: "このブラウザ",
        groupLabel: "このブラウザ",
        isDefault: true,
      },
      {
        value: "user",
        label: "個人",
        groupLabel: "個人",
        disabled: !userId,
      },
      {
        value: "team",
        label: "ワークスペース共通",
        groupLabel: "ワークスペース共通",
        disabled: !workspaceId,
      },
    ],
    [userId, workspaceId],
  );

  const controller = useColumnSettingsProfileController({
    schema,
    defaultFieldPaths,
    initialSettingId: selectedId,
    profilePersistence,
    storageScopeOptions,
  });

  // 選択中プロファイルを永続化（次回表示時に復元される）。
  // マウント直後は currentColumnSetting が null（非同期の初期ロード前）
  // なので、一度でも選択が立った後の null（明示的なデフォルト選択）だけを
  // 保存する。そうしないと初期 null で保存値を消してしまう
  const currentId = controller.currentColumnSetting?.id ?? null;
  const hasHadSelectionRef = useRef(false);
  useEffect(() => {
    if (currentId !== null) {
      hasHadSelectionRef.current = true;
      setSelectedId(currentId);
    } else if (hasHadSelectionRef.current) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  return controller;
}
