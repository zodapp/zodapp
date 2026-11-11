/**
 * 登録簿に載せない、サーバーだけの処理のルート。
 * 認証コンテキストは、登録簿の router と同じ関数（auth.ts）で作る。
 */
import type { IncomingMessage } from "node:http";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  canEditSurvey,
  createWorkspaceRequestSchema,
  newId,
  newWorkspaceId,
  responseBodySchema,
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

  // テストデータ：回答をまとめて作る（bulkWrite。変更イベントも配信される）
  router.post(
    "/test-data/responses",
    withAuth(async (auth, req, res) => {
      const body = z
        .object({
          workspaceId: z.string(),
          // JSON では日付が ISO の文字列になるので、Date に戻してから検証する
          responses: z
            .array(responseBodySchema.extend({ submittedAt: z.coerce.date() }))
            .min(1)
            .max(500),
        })
        .safeParse(req.body);
      if (!body.success) return fail(res, 400, "INVALID_INPUT", body.error.message);
      const { workspaceId, responses } = body.data;
      if (!canEditSurvey(auth, workspaceId)) {
        return fail(res, 403, "FORBIDDEN", "cannot write responses");
      }
      const result = await repository.responses.bulkWrite({
        scope: { workspaceId },
        items: responses.map((input) => ({
          key: { workspaceId, responseId: newId() },
          input,
        })),
      });
      res.json(result);
    }),
  );

  return router;
};
