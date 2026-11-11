/**
 * 登録簿から、サーバーの API（`serverApi.tasks.setStatus(key, params)`）を作る。
 * 認証コンテキストは「明示の `{ context }` → スコープ（AsyncLocalStorage）」の順に探す。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import {
  canFromArgs,
  contextFromOptions,
  DefinitionError,
  toRequest,
  type Endpoints,
  type OpRequest,
  type ResolvedEntry,
  type ServerApi,
} from "@zodapp/zod-dynamodb";
import { UnauthenticatedError } from "./errors";
import type { ExecuteOptions } from "./ops";
import type { Repository } from "./repository";

type Scope = { context: unknown };

/** アプリ全体で 1 つのスコープ（認証コンテキストの型もアプリ全体で 1 つ） */
const storage = new AsyncLocalStorage<Scope>();

/** 認証コンテキストを張って `fn` を実行する。中で呼んだ API は、この認証コンテキストを使う */
export const runWithContext = <T>(context: unknown, fn: () => T): T =>
  storage.run({ context }, fn);

/** いまのスコープの認証コンテキスト。スコープの外では `undefined` */
export const currentContext = (): unknown => storage.getStore()?.context;

/** Repository のうち、サーバーの API が使う部分 */
type Executor = Pick<Repository<{}>, "execute" | "authorize" | "forTable"> &
  Partial<Pick<Repository<{}>, "overrideMark">>;

export type ServerApiOptions<TReq, TCredential = TReq> = {
  repository: Executor;
  /**
   * リクエストから認証の情報を取り出す。型はアプリが決める（トークンの文字列、セッション ID、
   * 証明書の情報など）。ライブラリは中身を見ない。省くと、リクエストそのものを `context` に渡す
   */
  credential?: (req: TReq) => TCredential;
  /**
   * 認証の情報から認証コンテキストを作る。router、Gateway、`scope()` がリクエストのたびに呼び、
   * Gateway は `auth` メッセージや `revalidate` のときにも呼ぶ。
   * 認証の情報がなければ投げずに、匿名を表す値を返すことを勧める。
   * 正しくなければ `UnauthenticatedError` を投げる
   */
  context?: (credential: TCredential) => unknown;
  /**
   * 認証コンテキストの期限（ミリ秒の時刻）。操作の認可の前に毎回確かめ、過ぎていれば `UNAUTHENTICATED`。
   * Realtime Gateway は、期限の前（寿命の `rebuildAt` の時点）に、認証の情報からコンテキストを作り直す。
   * コンテキストの期限は、認証の情報（トークンなど）の期限を超えないように作る
   */
  expiresAt?: (context: any) => number | undefined;
  /**
   * 期限のほかに、認証コンテキストがまだ使えるか（アカウントの停止フラグなど）を確かめる。
   * 操作の認可の前に毎回、同期で呼ぶ（HTTP でも Gateway でも）。使えなければ `UnauthenticatedError` を投げる。
   * データベースは読まず、コンテキストの値だけで判定する
   */
  checkContext?: (context: any) => void;
};

/** Express 互換のミドルウェア */
type Middleware<TReq> = (
  req: TReq,
  res: unknown,
  next: (error?: unknown) => void,
) => void;

type Meta<E extends Endpoints<any>, TReq> = {
  /** 登録簿 */
  readonly endpoints: E;
  /**
   * リクエストから認証コンテキストを作る（`context` を渡さなかったら `undefined` を返す）。
   * 同じリクエスト（オブジェクト）には、最初の結果を返す（`scope()` と router で 2 回作らないため）
   */
  contextOf(req: TReq): Promise<unknown>;
  /** `context` を渡したか。router と Gateway が、作るときに確かめる */
  readonly hasContext: boolean;
  /** リクエストから認証の情報を取り出す（`credential` を渡さなかったら、リクエストそのもの） */
  credentialFromRequest(req: TReq): unknown;
  /** 認証の情報から認証コンテキストを作る（Gateway の `auth` メッセージと `revalidate` で使う） */
  contextFromCredential(credential: unknown): Promise<unknown>;
  /** 認証コンテキストがまだ使えるか（期限と `checkContext`）を確かめる。使えなければ `UnauthenticatedError` を投げる */
  checkContext(context: unknown): void;
  /** 認証コンテキストの期限（ミリ秒の時刻）。`expiresAt` を渡さなかったら `undefined` */
  expiresAt(context: unknown): number | undefined;
  /** リクエストの間、認証コンテキストのスコープを張るミドルウェア */
  scope(): Middleware<TReq>;
  /** Repository（Gateway がページを読むのに使う） */
  readonly repository: Executor;
  /** 登録簿の 1 件の、入力の検証と認可だけを同期で行う（Gateway の購読と配信で使う） */
  authorize(
    entry: ResolvedEntry,
    request: OpRequest,
    options?: ExecuteOptions,
  ): Record<string, unknown>;
  /** 登録簿の 1 件を、サーバーで実行する（router や Gateway が使う） */
  execute(
    entry: ResolvedEntry,
    request: OpRequest,
    options?: ExecuteOptions,
  ): Promise<unknown>;
};

export type ServerApiInstance<
  E extends Endpoints<any>,
  TReq = unknown,
> = ServerApi<E> & Meta<E, TReq>;

const RESERVED = new Set([
  "endpoints",
  "contextOf",
  "hasContext",
  "credentialFromRequest",
  "contextFromCredential",
  "checkContext",
  "expiresAt",
  "scope",
  "execute",
  "authorize",
  "repository",
]);

/**
 * サーバーの API を作る。
 *
 * ```ts
 * const serverApi = createServerApi(endpoints, { repository, context: (req: IncomingMessage) => resolveAuth(req) });
 * await serverApi.tasks.setStatus(key, { status: "done" }, { context: ctx });
 * ```
 */
export const createServerApi = <
  E extends Endpoints<any>,
  TReq = unknown,
  TCredential = TReq,
>(
  endpoints: E,
  options: ServerApiOptions<TReq, TCredential>,
): ServerApiInstance<E, TReq> => {
  const { repository } = options;
  if (
    repository.overrideMark !== undefined &&
    endpoints.mark !== undefined &&
    repository.overrideMark !== endpoints.mark
  ) {
    throw new DefinitionError(
      "the overrides of the repository and the endpoints come from different defineContext calls",
    );
  }
  const expiresAt = (context: unknown) =>
    context === undefined || context === null
      ? undefined
      : options.expiresAt?.(context);
  const checkContext = (context: unknown) => {
    if (context === undefined || context === null) return;
    const expiry = expiresAt(context);
    if (expiry !== undefined && expiry <= Date.now()) {
      throw new UnauthenticatedError("the auth context has expired");
    }
    options.checkContext?.(context);
  };
  /**
   * `context` キーがあればその値（`null` / `undefined` なら認証コンテキストなし）、なければスコープの値。
   * 使えるかを確かめてから返す
   */
  const resolve = (callOptions: { context?: unknown } | undefined) => {
    const context = contextFromOptions(callOptions, currentContext);
    checkContext(context);
    return context;
  };
  const execute = async (
    entry: ResolvedEntry,
    request: OpRequest,
    executeOptions: ExecuteOptions = {},
  ) =>
    repository.execute(entry.op, request, {
      context: resolve(executeOptions),
    });

  const credentialFromRequest = (req: TReq): unknown =>
    options.credential ? options.credential(req) : req;
  const contextFromCredential = async (credential: unknown) =>
    options.context?.(credential as TCredential);
  /** 同じリクエストの結果（Promise）。リクエストが終われば消える */
  const contextCache = new WeakMap<object, Promise<unknown>>();
  const contextOf = (req: TReq): Promise<unknown> => {
    const cacheable = typeof req === "object" && req !== null;
    const cached = cacheable ? contextCache.get(req) : undefined;
    if (cached) return cached;
    const created = Promise.resolve().then(() =>
      contextFromCredential(credentialFromRequest(req)),
    );
    if (cacheable) contextCache.set(req, created);
    return created;
  };
  const meta: Meta<E, TReq> = {
    endpoints,
    contextOf,
    hasContext: options.context !== undefined,
    credentialFromRequest,
    contextFromCredential,
    checkContext,
    expiresAt,
    execute,
    repository,
    authorize: (entry, request, authorizeOptions = {}) =>
      repository.authorize(entry.op, request, {
        context: resolve(authorizeOptions),
      }),
    scope: () => (req, _res, next) => {
      contextOf(req).then(
        (context) => storage.run({ context }, () => next()),
        (error) => next(error),
      );
    },
  };
  const api: Record<string, Record<string, unknown>> = {};
  for (const entry of endpoints.entries) {
    if (RESERVED.has(entry.group)) {
      throw new DefinitionError(
        `group name "${entry.group}" is reserved by the server API`,
      );
    }
    const fn = (...args: unknown[]) => {
      const { request, options: callOptions } = toRequest(entry.op, args);
      return execute(
        entry,
        request,
        Object.hasOwn(callOptions, "context")
          ? { context: callOptions.context }
          : {},
      );
    };
    Object.assign(fn, {
      op: entry.op,
      entry,
      server: meta,
      // `can` は判定だけなので、期限の確認（`checkContext`）はしない
      can: (...args: unknown[]) =>
        canFromArgs(entry.op, args, (o) =>
          contextFromOptions(o, currentContext),
        ),
    });
    if (entry.op.kind === "query") {
      Object.assign(fn, {
        pages: async function* (
          params: unknown,
          pageOptions: Record<string, unknown> = {},
        ) {
          let cursor = pageOptions.cursor as string | undefined;
          do {
            const out = (await fn(params, { ...pageOptions, cursor })) as {
              items: unknown[];
              cursor?: string;
            };
            yield out;
            cursor = out.cursor;
          } while (cursor);
        },
      });
    }
    (api[entry.group] ??= {})[entry.name] = fn;
  }

  return Object.assign(api, meta) as unknown as ServerApiInstance<E, TReq>;
};
