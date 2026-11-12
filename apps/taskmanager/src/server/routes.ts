/**
 * 登録簿に載せない、サーバーだけの処理のルート。
 * 認証コンテキストは、登録簿の router と同じ関数（auth.ts）で作る。
 */
import type { IncomingMessage } from "node:http";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import type { ServerApi } from "@zodapp/zod-dynamodb";
import { ConditionFailedError, ItemNotFoundError } from "@zodapp/zod-dynamodb-node";
import {
  canWriteTask,
  createWorkspaceRequestSchema,
  newWorkspaceId,
  taskBodySchema,
  type Auth,
  type Endpoints,
} from "../shared";
import type { AppRepository } from "./repository";

type ResolveAuth = (req: IncomingMessage) => Promise<Auth>;

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ code, message });

/** BatchWriteItem ではなく TransactWriteItems で確定するので、1 回の確定は 100 件まで */
const BATCH_SIZE = 100;

export const createAppRoutes = (deps: {
  repository: AppRepository;
  /** 認可込みの API（登録簿の操作を、サーバーの中から呼ぶ） */
  serverApi: ServerApi<Endpoints>;
  resolveAuth: ResolveAuth;
}): express.Router => {
  const { repository, serverApi, resolveAuth } = deps;
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
      let moved: { workspaceId: string; projectId: string; taskId: string } | undefined;
      try {
        moved = await repository.runTransaction(async (tx) => {
          // 移動先のプロジェクトがアクティブであることを、読まずに確定の条件にする（ConditionCheck）。
          // なければ ItemNotFoundError、アーカイブ済み・削除済みなら ConditionFailedError になる
          await repository.projects
            .withContext({ runner: tx })
            .check({ workspaceId, projectId: toProjectId }, { status: "active" });
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
      } catch (error) {
        if (error instanceof ItemNotFoundError) {
          return fail(res, 404, "NOT_FOUND", "project not found");
        }
        if (error instanceof ConditionFailedError) {
          return fail(res, 409, "CONDITION_FAILED", "target project is not active");
        }
        throw error;
      }
      if (!moved) return fail(res, 404, "NOT_FOUND", "task not found");
      res.json(moved);
    }),
  );

  // ゴミ箱を空にする：ゴミ箱のタスクのキーだけを読み、書き込みだけの batch で消す
  router.post(
    "/tasks/empty-trash",
    withAuth(async (auth, req, res) => {
      const body = z
        .object({ workspaceId: z.string(), projectId: z.string() })
        .safeParse(req.body);
      if (!body.success) return fail(res, 400, "INVALID_INPUT", body.error.message);
      const params = body.data;
      // 消すのは tasks.remove と同じ権限
      if (!canWriteTask(auth, params.workspaceId)) {
        return fail(res, 403, "FORBIDDEN", "cannot delete tasks");
      }
      // 一覧は、Repository ではなく登録簿の操作（tasks.deleted）を、この人の認証コンテキストで呼ぶ。
      // 認可はブラウザから呼ぶときと同じ定義で行われる。fields でキーだけを読む
      const keys: { workspaceId: string; projectId: string; taskId: string }[] = [];
      let cursor: string | undefined;
      do {
        const page = await serverApi.tasks.deleted(params, {
          context: auth,
          cursor,
          fields: { pick: ["taskId"] },
        });
        for (const item of page.items) {
          keys.push({ ...params, taskId: item.taskId });
        }
        cursor = page.cursor;
      } while (cursor);

      // 書き込みだけの batch（createBatch）。読み取りの記録がないので、
      // ライブラリが内部で読んだ後に他の更新と競合しても、読み直して再試行される
      let deleted = 0;
      try {
        for (let i = 0; i < keys.length; i += BATCH_SIZE) {
          const chunk = keys.slice(i, i + BATCH_SIZE);
          const batch = repository.createBatch();
          const tasks = repository.tasks.withContext({ runner: batch });
          for (const key of chunk) {
            // 一覧を読んだ後に復元されたものは消さない（条件が成り立たなければ、その回の確定が失敗する）
            await tasks.delete(key, { where: { deletedAt: { ne: null } } });
          }
          await batch.commit();
          deleted += chunk.length;
        }
      } catch (error) {
        if (error instanceof ConditionFailedError) {
          return fail(res, 409, "CONDITION_FAILED", `trash changed after ${deleted} deletions`);
        }
        throw error;
      }
      res.json({ deleted });
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
