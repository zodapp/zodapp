import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import type { createWorkspaceRequestSchema, workspaceSchema } from "../../../../shared";
import { api, postJson } from "../../../shared/api";
import { useMyMemberships } from "../../../shared/hooks";

// =====================================
// 型定義
// =====================================
export type WorkspaceData = z.infer<typeof workspaceSchema>;
export type CreateWorkspaceRequest = z.input<typeof createWorkspaceRequestSchema>;

// =====================================
// 非React依存: WorkspaceService
// =====================================
const WorkspaceService = {
  /** ワークスペースIDの配列からワークスペース詳細を取得 */
  async fetchWorkspacesByIds(workspaceIds: string[]): Promise<WorkspaceData[]> {
    const results = await Promise.all(
      workspaceIds.map((workspaceId) => api.workspaces.get({ workspaceId })),
    );
    return results.filter((ws): ws is WorkspaceData => ws !== null);
  },

  /**
   * ワークスペースを作成する。作成者のオーナー登録と追加メンバーは、サーバーが
   * 1 回のトランザクションで書く（Firestore 版ではブラウザから順に書いていた）
   */
  async createWorkspace(request: CreateWorkspaceRequest): Promise<string> {
    const { workspaceId } = await postJson<{ workspaceId: string }>("/workspaces", request);
    return workspaceId;
  },
};

// =====================================
// React依存: useUserWorkspaces
// =====================================
export interface UseUserWorkspacesResult {
  workspaces: WorkspaceData[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  createWorkspace: (request: CreateWorkspaceRequest) => Promise<string>;
}

export function useUserWorkspaces(): UseUserWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  // 所属メンバーシップ（members の email の Index）。リアルタイムで購読するので、
  // 他の人にワークスペースへ追加されると、すぐに一覧に出る
  const memberships = useMyMemberships({});

  const workspaceIds = useMemo(
    () => [...new Set(memberships.items.map((member) => member.workspaceId))],
    [memberships.items],
  );
  const workspaceIdsKey = workspaceIds.join(",");
  // 取得は常に最新の所属で行う（古いクロージャから refetch されても、古い一覧に戻さない）
  const workspaceIdsRef = useRef(workspaceIds);
  useEffect(() => {
    workspaceIdsRef.current = workspaceIds;
  }, [workspaceIds]);

  // 所属が続けて変わると取得が重なる。最後に始めた取得の結果だけを使う
  const latestRequest = useRef(0);
  const fetchWorkspaces = useCallback(async () => {
    const request = ++latestRequest.current;
    setIsLoadingWorkspaces(true);
    try {
      const result = await WorkspaceService.fetchWorkspacesByIds(workspaceIdsRef.current);
      if (request !== latestRequest.current) return;
      setWorkspaces(
        [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      );
    } catch (error) {
      if (request !== latestRequest.current) return;
      console.error("Failed to fetch workspaces:", error);
      setWorkspaces([]);
    } finally {
      if (request === latestRequest.current) setIsLoadingWorkspaces(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceIdsKey]);

  useEffect(() => {
    if (memberships.status !== "ready") return;
    void fetchWorkspaces();
  }, [fetchWorkspaces, memberships.status]);

  return {
    workspaces,
    isLoading: memberships.status === "loading" || isLoadingWorkspaces,
    refetch: fetchWorkspaces,
    createWorkspace: WorkspaceService.createWorkspace,
  };
}
