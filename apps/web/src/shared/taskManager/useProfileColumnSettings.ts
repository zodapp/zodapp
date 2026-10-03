import { useEffect, useMemo, useRef } from "react";
import type { z } from "zod";
import { firestore } from "@repo/firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";
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

import { useAuthContext, useStoreKey } from "../auth";
import {
  userColumnSettingsCollection,
  userColumnSettingQueries,
  workspaceColumnSettingsCollection,
  workspaceColumnSettingQueries,
} from "./collections/columnSetting";

// =====================================================================
// 列設定プロファイルの 3 スコープ永続化
//   - local: このブラウザ（localStorage）
//   - user : 個人（Firestore /users/:uid/columnSettings）
//   - team : ワークスペース共通（Firestore /workspaces/:id/columnSettings）
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

// Firestore は undefined を保存できないため、optional な fieldPath を除去する
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
  const storeKey = useStoreKey();
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

  const userAccessor = useMemo(
    () => getAccessor(firestore, userColumnSettingsCollection, storeKey),
    [storeKey],
  );
  const workspaceAccessor = useMemo(
    () => getAccessor(firestore, workspaceColumnSettingsCollection, storeKey),
    [storeKey],
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

        if (userId) {
          const docs = await userAccessor.query(
            { userId },
            userColumnSettingQueries.queries.byTable(tableKey),
          );
          refs.push(
            ...docs.map((doc) => toRef("user", doc.settingId, doc.name)),
          );
        }
        if (workspaceId) {
          const docs = await workspaceAccessor.query(
            { workspaceId },
            workspaceColumnSettingQueries.queries.byTable(tableKey),
          );
          refs.push(
            ...docs.map((doc) => toRef("team", doc.settingId, doc.name)),
          );
        }
        return refs;
      },

      loadColumnSetting: async (scopedId) => {
        const { scope, id } = parseScopedId(scopedId);
        if (scope === "local") {
          const profile = localProfilesRef.current[id];
          return profile ? { columns: profile.columns } : null;
        }
        if (scope === "user") {
          if (!userId) return null;
          const doc = await userAccessor.getDoc({ userId, settingId: id });
          return doc ? { columns: (doc.columns ?? null) as ColumnEntry[] | null } : null;
        }
        if (!workspaceId) return null;
        const doc = await workspaceAccessor.getDoc({
          workspaceId,
          settingId: id,
        });
        return doc ? { columns: (doc.columns ?? null) as ColumnEntry[] | null } : null;
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
        if (type === "user") {
          if (!userId) throw new Error("ログインが必要です");
          const id = await userAccessor.createDoc(
            { userId },
            { tableKey, name, columns: sanitized },
          );
          return toRef("user", id, name);
        }
        if (!workspaceId) throw new Error("ワークスペース外では保存できません");
        const id = await workspaceAccessor.createDoc(
          { workspaceId },
          { tableKey, name, columns: sanitized },
        );
        return toRef("team", id, name);
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
        if (scope === "user") {
          if (!userId) return;
          await userAccessor.updateDoc({ userId, settingId: id }, data);
          return;
        }
        if (!workspaceId) return;
        await workspaceAccessor.updateDoc({ workspaceId, settingId: id }, data);
      },

      deleteColumnSetting: async (scopedId) => {
        const { scope, id } = parseScopedId(scopedId);
        if (scope === "local") {
          const next = { ...localProfilesRef.current };
          delete next[id];
          setLocalProfiles(next);
          return;
        }
        if (scope === "user") {
          if (!userId) return;
          await userAccessor.deleteDoc({ userId, settingId: id });
          return;
        }
        if (!workspaceId) return;
        await workspaceAccessor.deleteDoc({ workspaceId, settingId: id });
      },
    };
  }, [
    tableKey,
    userId,
    workspaceId,
    userAccessor,
    workspaceAccessor,
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
