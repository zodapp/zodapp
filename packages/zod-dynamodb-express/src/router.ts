/**
 * サーバーの API（`createServerApi`）を HTTP で公開する。
 * 入力の変換と検証、出力の変換、エラーの形は今のエンドポイント（§8.6）と同じ。
 */
import {
  DefinitionError,
  ERROR_STATUS,
  toErrorBody,
  toErrorCode,
  type OpRequest,
  type ResolvedEntry,
} from "@zodapp/zod-dynamodb";
import { runWithContext } from "@zodapp/zod-dynamodb-node";
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

/** 1つのリクエストの結果。`passthrough` は Express の `next(error)` に渡す */
export type ProtocolOutcome =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "passthrough"; error: unknown };

/** サーバーの API のうち、HTTP で公開するのに使う部分 */
type ServerApiLike = {
  readonly endpoints: { readonly entries: readonly ResolvedEntry[] };
  contextOf(req: Request): Promise<unknown>;
  /** `createServerApi` に `context` を渡したか */
  readonly hasContext: boolean;
  execute(
    entry: ResolvedEntry,
    request: OpRequest,
    options?: { context?: unknown },
  ): Promise<unknown>;
};

/** サーバーの API の関数（`serverApi.tasks.byStatus`） */
type ServerApiFunction = {
  readonly entry: ResolvedEntry;
  readonly server: ServerApiLike;
};

export type RouterOptions = {
  /** `INTERNAL`（500）にしたエラーを受け取る。既定ではログに出す */
  onError?: (error: unknown, req: Request) => void;
};

export type HandleOptions = RouterOptions & {
  /** 入力の読み出し方。既定は、`GET` ならクエリ文字列の `input`、それ以外はリクエストの body */
  input?: (req: Request) => unknown;
};

type Input = Record<string, any>;

/** HTTP で受けた入力（エンドポイントの入力の形）を、操作の入力に直す */
const toOpRequest = (entry: ResolvedEntry, input: Input): OpRequest => {
  switch (entry.op.kind) {
    case "get":
      // HTTP の Get は、常にトークンも返す（Client が要らなければ捨てる）
      return { key: input, withToken: true };
    case "create":
    case "set":
      return { key: input.key, input: input.input };
    case "createWithGeneratedKey":
      return { args: input.args, input: input.input };
    case "delete":
      return { key: input.key };
    case "mutation":
      return {
        key: input.key,
        params: input.params,
        ifUnchanged: input.ifUnchanged,
      };
    case "search":
      return { params: input.params, fields: input.fields };
    case "query":
      return {
        params: input.params,
        cursor: input.cursor,
        limit: input.limit,
        fields: input.fields,
      };
  }
};

/** 実行の結果を、エンドポイントの出力の形に直す */
const toOutput = (entry: ResolvedEntry, result: any): unknown => {
  switch (entry.op.kind) {
    case "get":
      return result;
    case "delete":
      // ブラウザには削除前の Item を返さない
      return {};
    case "query":
      return result;
    case "search":
      return { results: result };
    default:
      return { item: result };
  }
};

const errorResponse = (error: unknown): ProtocolOutcome => {
  const body = toErrorBody(error);
  return { kind: "response", status: ERROR_STATUS[body.code], body };
};

/** `GET` のとき、クエリ文字列の `input`（入力全体の JSON）を読む */
export const fromQueryString = (req: Request): unknown => {
  const raw = req.query.input;
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** 登録簿の 1 件のリクエストを処理する（Express に依存しない部分） */
export const handleEntry = async (
  server: ServerApiLike,
  entry: ResolvedEntry,
  json: unknown,
  req: Request,
  onError: (error: unknown) => void,
): Promise<ProtocolOutcome> => {
  const endpoint = entry.endpoint!;
  // 1. 入力を JSON から戻し、Schema で検証する
  let input: Input;
  try {
    input = endpoint.decodeInput(json) as Input;
  } catch (error) {
    return errorResponse(
      Object.assign(new Error("invalid input"), {
        name: "ValidationError",
        issues: (error as { issues?: unknown }).issues,
      }),
    );
  }
  // 2. 認証コンテキスト。`UnauthenticatedError` は 401、ほかのアプリケーションのエラーはそのまま返す
  let context: unknown;
  try {
    context = await server.contextOf(req);
  } catch (error) {
    if (toErrorCode(error) === "UNAUTHENTICATED") return errorResponse(error);
    return { kind: "passthrough", error };
  }
  // 3. スコープを張って実行し、出力を JSON に変換する
  try {
    const result = await runWithContext(context, () =>
      server.execute(entry, toOpRequest(entry, input), { context }),
    );
    return {
      kind: "response",
      status: 200,
      body: endpoint.encodeOutput(toOutput(entry, result), input),
    };
  } catch (error) {
    const outcome = errorResponse(error);
    if (outcome.kind === "response" && outcome.status >= 500) onError(error);
    return outcome;
  }
};

const middleware = (
  server: ServerApiLike,
  entry: ResolvedEntry,
  options: HandleOptions,
): RequestHandler => {
  if (entry.serverOnly || !entry.endpoint) {
    throw new TypeError(
      `operation "${entry.group}.${entry.name}" is server-only and cannot be served over HTTP`,
    );
  }
  const read =
    options.input ??
    (entry.method === "GET" ? fromQueryString : (req: Request) => req.body);
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outcome = await handleEntry(server, entry, read(req), req, (e) =>
        (options.onError ?? ((err) => console.error(err)))(e, req),
      );
      if (outcome.kind === "passthrough") {
        next(outcome.error);
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 登録簿の `path` と `method` で、すべての公開する操作のルートを作る。
 * サーバー専用の操作と、`path` のない操作は公開しない。
 *
 * ```ts
 * app.use(express.json());
 * app.use(router(serverApi));
 * ```
 */
export const router = (
  server: ServerApiLike,
  options: RouterOptions = {},
): Router => {
  if (
    !server.hasContext &&
    server.endpoints.entries.some((e) => !e.serverOnly && e.path !== undefined)
  ) {
    throw new DefinitionError(
      "router needs the context option of createServerApi to serve operations with authorize",
    );
  }
  const r = Router();
  for (const entry of server.endpoints.entries) {
    if (entry.serverOnly || entry.path === undefined) continue;
    const method = entry.method.toLowerCase() as
      "get" | "post" | "put" | "patch" | "delete";
    r[method](entry.path, middleware(server, entry, options));
  }
  return r;
};

/**
 * 操作 1 つを処理するミドルウェアを返す（パスを自分で決めるとき用）。
 *
 * ```ts
 * app.get("/tasks/:workspaceId", handle(serverApi.tasks.byStatus, { input: (req) => ({ ... }) }));
 * ```
 */
export const handle = (
  fn: { readonly op: unknown },
  options: HandleOptions = {},
): RequestHandler => {
  const f = fn as Partial<ServerApiFunction>;
  if (!f.entry || !f.server) {
    throw new TypeError(
      "handle() takes a function of the server API (createServerApi)",
    );
  }
  if (!f.server.hasContext && !f.entry.serverOnly) {
    throw new DefinitionError(
      "handle() needs the context option of createServerApi to serve operations with authorize",
    );
  }
  return middleware(f.server, f.entry, options);
};
