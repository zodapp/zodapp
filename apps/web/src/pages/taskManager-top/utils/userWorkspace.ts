import { useState, useCallback, useEffect } from "react";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import type { z } from "zod";

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
export const WorkspaceService = {
  /**
   * ユーザーのメールアドレスから所属ワークスペースIDを取得
   * collectionGroup("members")を使用してクエリ
   */
  async fetchWorkspaceIdsByEmail(userEmail: string): Promise<string[]> {
    const membersQuery = firestore
      .collectionGroup("members")
      .where("email", "==", userEmail);

    const memberSnapshots = await membersQuery.get();

    // パス: /workspaces/{workspaceId}/members/{memberId} から workspaceId を抽出
    return memberSnapshots.docs
      .map((doc) => doc.ref.parent.parent?.id)
      .filter((id): id is string => id !== undefined);
  },

  /**
   * ワークスペースIDの配列からワークスペース詳細を取得
   */
  async fetchWorkspacesByIds(workspaceIds: string[]): Promise<WorkspaceData[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    const workspaceAccessor = getAccessor(firestore, workspacesCollection);
    const workspacePromises = workspaceIds.map((workspaceId) =>
      workspaceAccessor.getDoc({ workspaceId }),
    );
    const workspaceResults = await Promise.all(workspacePromises);

    // nullを除外
    return workspaceResults.filter((ws): ws is WorkspaceData => ws !== null);
  },

  /**
   * ユーザーの所属ワークスペースを取得（IDの取得から詳細取得・ソートまで一括）
   */
  async fetchUserWorkspaces(userEmail: string): Promise<WorkspaceData[]> {
    const workspaceIds = await this.fetchWorkspaceIdsByEmail(userEmail);
    const workspaces = await this.fetchWorkspacesByIds(workspaceIds);
    return [...workspaces].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  },

  /**
   * ワークスペースを作成し、作成者をオーナーとしてメンバーに追加
   * @returns 作成されたワークスペースID
   */
  async createWorkspaceWithOwner(
    data: WorkspaceCreateData,
    owner: WorkspaceOwnerInfo,
  ): Promise<string> {
    // 1. ワークスペース作成（ownerIdを設定）
    const workspaceAccessor = getAccessor(firestore, workspacesCollection);
    const workspaceId = await workspaceAccessor.createDoc(
      {},
      {
        ...data,
        ownerId: owner.email,
      },
    );
    const memberAccessor = getAccessor(firestore, membersCollection);
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
  createWorkspaceWithOwner: typeof WorkspaceService.createWorkspaceWithOwner;
}

export function useUserWorkspaces(
  userEmail: string | null | undefined,
): UseUserWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserWorkspaces = useCallback(async () => {
    if (!userEmail) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await WorkspaceService.fetchUserWorkspaces(userEmail);
      setWorkspaces(result);
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  // 初回マウント時とuserEmail変更時にワークスペースを取得
  useEffect(() => {
    void fetchUserWorkspaces();
  }, [fetchUserWorkspaces]);

  return {
    workspaces,
    isLoading,
    refetch: fetchUserWorkspaces,
    createWorkspaceWithOwner: WorkspaceService.createWorkspaceWithOwner,
  };
}
