import { useState, useCallback, useEffect, useMemo } from "react";
import {
  getAccessor,
  type AccessorStoreKey,
} from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import type { z } from "zod";
import { useStoreKey } from "../../../shared/auth";
import { useCollectionGroupList } from "../../../shared/taskManager/hooks";

import {
  workspacesCollection,
  membersCollection,
} from "../../../shared/taskManager/collections";

// =====================================
// 型定義
// =====================================
export type WorkspaceData = z.infer<typeof workspacesCollection.dataSchema>;
export type WorkspaceCreateData = z.infer<
  typeof workspacesCollection.createSchema
>;

export interface WorkspaceOwnerInfo {
  email: string;
  displayName: string;
}

// =====================================
// 非React依存: WorkspaceService
// Firestoreへのアクセスロジックを提供
// =====================================
const WorkspaceService = {
  /**
   * ワークスペースIDの配列からワークスペース詳細を取得
   */
  async fetchWorkspacesByIds(
    workspaceIds: string[],
    storeKey: AccessorStoreKey,
  ): Promise<WorkspaceData[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const workspaceAccessor = getAccessor(
      firestore,
      workspacesCollection,
      storeKey,
    );
    const workspacePromises = workspaceIds.map((workspaceId) =>
      workspaceAccessor.getDoc({ workspaceId }),
    );
    const workspaceResults = await Promise.all(workspacePromises);

    // nullを除外
    return workspaceResults.filter((ws): ws is WorkspaceData => ws !== null);
  },

  /**
   * ワークスペースを作成し、作成者をオーナーとしてメンバーに追加
   * @returns 作成されたワークスペースID
   */
  async createWorkspaceWithOwner(
    data: WorkspaceCreateData,
    owner: WorkspaceOwnerInfo,
    storeKey: AccessorStoreKey,
  ): Promise<string> {
    // 1. ワークスペース作成（ownerIdを設定）
    const workspaceAccessor = getAccessor(
      firestore,
      workspacesCollection,
      storeKey,
    );
    const workspaceId = await workspaceAccessor.createDoc(
      {},
      {
        ...data,
        ownerId: owner.email,
      },
    );
    const memberAccessor = getAccessor(firestore, membersCollection, storeKey);
    await memberAccessor.createDoc(
      { workspaceId },
      {
        email: owner.email,
        displayName: owner.displayName,
        role: "owner",
      },
    );
    return workspaceId;
  },
};

// =====================================
// React依存: useUserWorkspaces
// ワークスペース取得のカスタムフック
// =====================================
export interface UseUserWorkspacesResult {
  workspaces: WorkspaceData[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  createWorkspaceWithOwner: (
    data: WorkspaceCreateData,
    owner: WorkspaceOwnerInfo,
  ) => Promise<string>;
}

export function useUserWorkspaces(
  userEmail: string | null | undefined,
): UseUserWorkspacesResult {
  const storeKey = useStoreKey();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  // 所属メンバーシップを collectionGroup クエリで横断検索する。
  // membersCollection は workspaceId を pathFieldKey としてフィールド保存
  // しているため、結果の各ドキュメントから所属ワークスペースが分かる。
  const {
    items: memberships,
    isLoading: isMembershipsLoading,
    refresh: refreshMemberships,
  } = useCollectionGroupList({
    collection: membersCollection,
    query: useMemo(
      () => ({
        where: [
          {
            field: "email",
            operator: "==" as const,
            value: userEmail ?? "",
          },
        ],
      }),
      [userEmail],
    ),
    enabled: !!userEmail,
  });

  const workspaceIds = useMemo(
    () => [...new Set(memberships.map((member) => member.workspaceId))],
    [memberships],
  );
  const workspaceIdsKey = workspaceIds.join(",");

  const fetchWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const result = await WorkspaceService.fetchWorkspacesByIds(
        workspaceIds,
        storeKey,
      );
      setWorkspaces(
        [...result].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }),
      );
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      setWorkspaces([]);
    } finally {
      setIsLoadingWorkspaces(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceIdsKey, storeKey]);

  useEffect(() => {
    if (isMembershipsLoading) return;
    void fetchWorkspaces();
  }, [fetchWorkspaces, isMembershipsLoading]);

  const refetch = useCallback(async () => {
    refreshMemberships();
    await fetchWorkspaces();
  }, [refreshMemberships, fetchWorkspaces]);

  const createWorkspaceWithOwner = useCallback(
    (data: WorkspaceCreateData, owner: WorkspaceOwnerInfo) =>
      WorkspaceService.createWorkspaceWithOwner(data, owner, storeKey),
    [storeKey],
  );

  return {
    workspaces,
    isLoading: isMembershipsLoading || isLoadingWorkspaces,
    refetch,
    createWorkspaceWithOwner,
  };
}
