/**
 * 登録簿に載せない、サーバーだけの処理のルート。
 * 認証コンテキストは、登録簿の router と同じ関数（auth.ts）で作る。
 */
import type { IncomingMessage } from "node:http";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  canWriteTask,
  createWorkspaceRequestSchema,
  newWorkspaceId,
  taskBodySchema,
  type Auth,
} from "../shared";
import type { AppRepository } from "./repository";

type ResolveAuth = (req: IncomingMessage) => Promise<Auth>;

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ code, message });

export const createAppRoutes = (deps: {
  repository: AppRepository;
  resolveAuth: ResolveAuth;
}): express.Router => {
  const { repository, resolveAuth } = deps;
  const router = express.Router();

  const withAuth =
    (handler: (auth: Auth, req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response, next: (e?: unknown) => void) => {
      try {
        const auth = await resolveAuth(req);
        if (!auth.userId) return fail(res, 401, "UNAUTHENTICATED", "login required");
        await handler(auth, req, res);
      } catch (error) {
        next(error);
      }
    };

  // ワークスペースの作成：ワークスペース・オーナー・追加メンバーを 1 回のトランザクションで
  router.post(
    "/workspaces",
    withAuth(async (auth, req, res) => {
      const parsed = createWorkspaceRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 400, "INVALID_INPUT", parsed.error.message);
      }
      const { workspace, ownerDisplayName, members } = parsed.data;
      const workspaceId = newWorkspaceId();
      const others = members.filter(
        (m) => m.email.toLowerCase() !== auth.email,
      );
      await repository.runTransaction(async (tx) => {
        await repository.workspaces
          .withContext({ runner: tx })
          .create({ workspaceId }, { ...workspace, ownerId: auth.email });
        const memberAccessor = repository.members.withContext({ runner: tx });
        await memberAccessor.create(
          { workspaceId, email: auth.email },
          { displayName: ownerDisplayName, role: "owner" },
        );
        for (const m of others) {
          await memberAccessor.create(
            { workspaceId, email: m.email.toLowerCase() },
            { displayName: m.displayName, role: m.role },
          );
        }
      });
      res.json({ workspaceId });
    }),
  );

  // タスクを別のプロジェクトへ移す：読み取り → 移動先へ書き込み → 移動元を削除を、
  // 1 回のトランザクションで行う（途中で失敗しても、重複も消失も起きない）
  router.post(
    "/tasks/move",
    withAuth(async (auth, req, res) => {
      const body = z
        .object({
          workspaceId: z.string(),
          projectId: z.string(),
          taskId: z.string(),
          toProjectId: z.string(),
        })
        .safeParse(req.body);
      if (!body.success) return fail(res, 400, "INVALID_INPUT", body.error.message);
      const { workspaceId, projectId, taskId, toProjectId } = body.data;
      if (!canWriteTask(auth, workspaceId)) {
        return fail(res, 403, "FORBIDDEN", "cannot move tasks");
      }
      if (toProjectId === projectId) {
        return fail(res, 400, "INVALID_INPUT", "same project");
      }
      const target = await repository.projects.get({ workspaceId, projectId: toProjectId });
      if (!target) return fail(res, 404, "NOT_FOUND", "project not found");

      const moved = await repository.runTransaction(async (tx) => {
        const tasks = repository.tasks.withContext({ runner: tx });
        const current = await tasks.get({ workspaceId, projectId, taskId });
        if (!current) return undefined;
        await tasks.set({ workspaceId, projectId: toProjectId, taskId }, {
          ...current,
          projectId: toProjectId,
        });
        await tasks.delete({ workspaceId, projectId, taskId });
        return { workspaceId, projectId: toProjectId, taskId };
      });
      if (!moved) return fail(res, 404, "NOT_FOUND", "task not found");
      res.json(moved);
    }),
  );

  // テストデータ：タスクをまとめて作る（bulkWrite。変更イベントも配信される）
  router.post(
    "/test-data/tasks",
    withAuth(async (auth, req, res) => {
      const body = z
        .object({
          workspaceId: z.string(),
          projectId: z.string(),
          // JSON では日付が ISO の文字列になるので、Date に戻してから検証する
          tasks: z
            .array(taskBodySchema.extend({ dueAt: z.coerce.date().optional() }))
            .min(1)
            .max(500),
        })
        .safeParse(req.body);
      if (!body.success) return fail(res, 400, "INVALID_INPUT", body.error.message);
      const { workspaceId, projectId, tasks } = body.data;
      if (!canWriteTask(auth, workspaceId)) {
        return fail(res, 403, "FORBIDDEN", "cannot write tasks");
      }
      const result = await repository.tasks.bulkWrite({
        scope: { workspaceId, projectId },
        items: tasks.map((input) => ({
          key: { workspaceId, projectId, taskId: newWorkspaceId() },
          input,
        })),
      });
      res.json(result);
    }),
  );

  return router;
};
