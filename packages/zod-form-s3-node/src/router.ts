import { DEFAULT_S3_FILE_PATHS } from "@zodapp/zod-form-s3";
import express, {
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from "express";
import { z } from "zod";
import { isSafeKey, newKeyUnder } from "./keys";
import type { S3FileSigner } from "./signer";

type Awaitable<T> = T | Promise<T>;

export type S3FileRouterOptions<TContext> = {
  signer: S3FileSigner;
  /**
   * リクエストから認証コンテキストを作る（zod-dynamodb の router と同じ関数を渡せる）。
   * `null` / `undefined` を返したら 401
   */
  context: (req: Request) => Awaitable<TContext | null | undefined>;
  /** このキーにアップロードしてよいか。キーは `prefix` の下に、サーバーが作る */
  canUpload: (
    context: TContext,
    request: { key: string; prefix: string; contentType: string },
  ) => Awaitable<boolean>;
  /** このキーを読んでよいか */
  canRead: (context: TContext, request: { key: string }) => Awaitable<boolean>;
  /** このキーを消してよいか。省略すると、削除のエンドポイントを作らない */
  canDelete?: (context: TContext, request: { key: string }) => Awaitable<boolean>;
  /** パス。既定は `@zodapp/zod-form-s3` の既定と同じ */
  paths?: { upload?: string; download?: string; delete?: string };
  /** 受け付ける content-type。省略するとすべて */
  allowContentType?: (contentType: string) => boolean;
};

const uploadBody = z.object({
  prefix: z.string().min(1).max(512),
  contentType: z.string().min(1).max(200),
});
const keyBody = z.object({ key: z.string() });

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ code, message });

/**
 * ファイルの署名付き URL を発行する Express の router。
 * ブラウザの `@zodapp/zod-form-s3`（`httpS3FileEndpoints`）が呼ぶ。
 * body の JSON は、アプリが `app.use(express.json())` で読んでおく。
 *
 * ```ts
 * app.use("/api", createS3FileRouter({
 *   signer,
 *   context: (req) => resolveAuth(req),
 *   canUpload: (auth, { key }) => canWrite(auth, workspaceOfKey(key)),
 *   canRead: (auth, { key }) => isMember(auth, workspaceOfKey(key)),
 * }));
 * ```
 */
export const createS3FileRouter = <TContext>(
  options: S3FileRouterOptions<TContext>,
): Router => {
  const paths = { ...DEFAULT_S3_FILE_PATHS, ...options.paths };
  const router = express.Router();

  const withContext =
    (handler: (context: TContext, req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = await options.context(req);
        if (context == null) {
          return fail(res, 401, "UNAUTHENTICATED", "authentication required");
        }
        await handler(context, req, res);
      } catch (error) {
        next(error);
      }
    };

  router.post(
    paths.upload,
    withContext(async (context, req, res) => {
      const body = uploadBody.safeParse(req.body);
      if (!body.success) return fail(res, 400, "INVALID_INPUT", body.error.message);
      const { prefix, contentType } = body.data;
      const key = newKeyUnder(prefix);
      if (!isSafeKey(key)) return fail(res, 400, "INVALID_INPUT", "invalid prefix");
      if (options.allowContentType && !options.allowContentType(contentType)) {
        return fail(res, 400, "INVALID_INPUT", "content type not allowed");
      }
      if (!(await options.canUpload(context, { key, prefix, contentType }))) {
        return fail(res, 403, "FORBIDDEN", "cannot upload here");
      }
      res.json({ key, url: await options.signer.signUpload(key, contentType) });
    }),
  );

  router.post(
    paths.download,
    withContext(async (context, req, res) => {
      const body = keyBody.safeParse(req.body);
      if (!body.success || !isSafeKey(body.data.key)) {
        return fail(res, 400, "INVALID_INPUT", "invalid key");
      }
      const { key } = body.data;
      if (!(await options.canRead(context, { key }))) {
        return fail(res, 403, "FORBIDDEN", "cannot read this file");
      }
      res.json({ url: await options.signer.signDownload(key) });
    }),
  );

  const canDelete = options.canDelete;
  if (canDelete) {
    router.post(
      paths.delete,
      withContext(async (context, req, res) => {
        const body = keyBody.safeParse(req.body);
        if (!body.success || !isSafeKey(body.data.key)) {
          return fail(res, 400, "INVALID_INPUT", "invalid key");
        }
        const { key } = body.data;
        if (!(await canDelete(context, { key }))) {
          return fail(res, 403, "FORBIDDEN", "cannot delete this file");
        }
        await options.signer.deleteObject(key);
        res.json({});
      }),
    );
  }

  return router;
};
