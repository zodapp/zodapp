/**
 * 登録簿から、ブラウザの API（`api.tasks.setStatus(key, params)`）を作る。
 * 各関数は登録簿の `path` と `method` で送り、`can`（同期の判定）と、`live` を付けたクエリでは
 * `live`（リアルタイムの一覧）を持つ。
 */
import {
  canFromArgs,
  contextFromOptions,
  subscriptionId,
  toRequest,
  type Api,
  type Endpoints,
  type OpRequest,
  type ResolvedEntry,
} from "@zodapp/zod-dynamodb";
import {
  createRealtimeConnection,
  type RealtimeConnection,
  type RealtimeConnectionOptions,
} from "./connection";
import { callEndpoint, type CallOptions, type HttpOptions } from "./http";
import { createLiveListStore, type LiveListOptions } from "./live";

export type ClientOptions = HttpOptions & {
  /** リアルタイムの一覧（`api.tasks.byStatus.live(...)`）を使うときの、Gateway への接続 */
  realtime?: RealtimeConnectionOptions;
};

/** ブラウザでの認証コンテキスト。`can` の判定に使う（HTTP では送らない） */
export type ClientContext<TAuth = unknown> = {
  /** グローバルな値を設定する。ブラウザでだけ使える（SSR のサーバーで呼ぶとエラー） */
  set(context: TAuth | undefined): void;
  /** いまのグローバルな値 */
  get(): TAuth | undefined;
};

type ClientMeta<E extends Endpoints<any>> = {
  /** 認証コンテキスト（グローバルな値） */
  readonly context: ClientContext<any>;
  /** 登録簿 */
  readonly endpoints: E;
  /**
   * 認証コンテキストを固定した API を返す。`can` は明示の `{ context }` がなければこの値を使う。
   * React では `ApiProvider` がこれを使う
   */
  bind(context: unknown): ClientInstance<E>;
  /** Realtime Gateway への接続 */
  readonly realtime: {
    /**
     * 認証の情報を、接続を保ったまま入れ替える（トークンを更新したときなど）。
     * `payload` の形はアプリが決め、Gateway の `credentialOf` で読む。接続していなければ何もしない
     */
    authenticate(payload: unknown): void;
  };
};

export type ClientInstance<E extends Endpoints<any>> = Api<E> & ClientMeta<E>;

const RESERVED = new Set(["context", "endpoints", "bind", "realtime"]);

const isServer = () => typeof window === "undefined";

/** API の位置引数（操作の入力）を、HTTP で送る入力の形に直す */
const toHttpInput = (entry: ResolvedEntry, req: OpRequest): unknown => {
  switch (entry.op.kind) {
    case "get":
      return req.key;
    case "create":
    case "set":
      return { key: req.key, input: req.input };
    case "createWithGeneratedKey":
      return { args: req.args, input: req.input };
    case "delete":
      return { key: req.key };
    case "mutation":
      return {
        key: req.key,
        params: req.params,
        ...(req.ifUnchanged === undefined
          ? {}
          : { ifUnchanged: req.ifUnchanged }),
      };
    case "query":
      return {
        params: req.params,
        ...(req.cursor === undefined ? {} : { cursor: req.cursor }),
        ...(req.limit === undefined ? {} : { limit: req.limit }),
        ...(req.fields === undefined ? {} : { fields: req.fields }),
      };
    case "search":
      return {
        params: req.params,
        ...(req.fields === undefined ? {} : { fields: req.fields }),
      };
  }
};

/** HTTP の出力を、API の戻り値の形に直す */
const fromHttpOutput = (
  entry: ResolvedEntry,
  req: OpRequest,
  out: any,
): unknown => {
  switch (entry.op.kind) {
    case "get":
      return req.withToken
        ? { item: out.item ?? null, ...(out.token ? { token: out.token } : {}) }
        : (out.item ?? null);
    case "delete":
      return undefined;
    case "query":
      return {
        items: out.items,
        ...(out.cursor ? { cursor: out.cursor } : {}),
      };
    case "search":
      return out.results;
    default:
      return out.item;
  }
};

/**
 * ブラウザの API を作る。
 *
 * ```ts
 * export const api = createClient(endpoints, { baseUrl: "/api", credentials: "include" });
 * await api.tasks.setStatus(key, { status: "done" });
 * api.tasks.setStatus.can(key, { status: "done" }, { item: task }); // 同期
 * ```
 */
export const createClient = <E extends Endpoints<any>>(
  endpoints: E,
  options: ClientOptions,
): ClientInstance<E> => {
  let global: unknown;
  const context: ClientContext = {
    set: (value) => {
      if (isServer()) {
        throw new Error(
          "api.context.set() is only for the browser: on the server, pass { context } or use the bound API (useApi)",
        );
      }
      global = value;
    },
    get: () => global,
  };
  const globalContext = () => {
    if (isServer()) {
      throw new Error(
        "the global auth context is only for the browser: pass { context } or use the bound API (useApi)",
      );
    }
    return global;
  };

  let connection: RealtimeConnection | undefined;
  const connectionOf = () => {
    if (!options.realtime) {
      throw new Error("live() needs the realtime option of createClient");
    }
    connection ??= createRealtimeConnection(options.realtime);
    return connection;
  };

  const build = (bound: { context: unknown } | undefined) => {
    /** `context` キーがあればその値（`null` / `undefined` なら認証コンテキストなし）、なければ bind かグローバルの値 */
    const resolve = (callOptions: { context?: unknown }) =>
      contextFromOptions(callOptions, () =>
        bound ? bound.context : globalContext(),
      );
    const api: Record<string, Record<string, unknown>> = {};
    for (const entry of endpoints.entries) {
      if (entry.serverOnly) continue;
      if (entry.path === undefined && !entry.subscription) continue;
      if (RESERVED.has(entry.group)) {
        throw new TypeError(
          `group name "${entry.group}" is reserved by the client`,
        );
      }
      const fn = Object.assign(
        entry.path === undefined
          ? () => {
              throw new TypeError(
                `"${entry.group}.${entry.name}" has no path: only live() is available`,
              );
            }
          : async (...args: unknown[]) => {
              const { request, options: callOptions } = toRequest(
                entry.op,
                args,
              );
              const out = await callEndpoint(
                options,
                entry.endpoint!,
                toHttpInput(entry, request),
                callOptions as CallOptions,
              );
              return fromHttpOutput(entry, request, out);
            },
        {
          op: entry.op,
          entry,
          can: (...args: unknown[]) => canFromArgs(entry.op, args, resolve),
        },
      );
      if (entry.op.kind === "query" && entry.path !== undefined) {
        const call = fn as unknown as (
          params: unknown,
          options: Record<string, unknown>,
        ) => Promise<{ items: unknown[]; cursor?: string }>;
        (fn as { pages?: unknown }).pages = async function* (
          params: unknown,
          pageOptions: Record<string, unknown> = {},
        ) {
          let cursor = pageOptions.cursor as string | undefined;
          do {
            const out = await call(params, { ...pageOptions, cursor });
            yield out;
            cursor = out.cursor;
          } while (cursor);
        };
      }
      if (entry.subscription) {
        const subscription = entry.subscription;
        (fn as { live?: unknown }).live = (
          params: unknown,
          listOptions?: LiveListOptions,
        ) =>
          createLiveListStore(
            {
              connection: connectionOf(),
              name: subscriptionId(entry),
              subscription,
            },
            params,
            listOptions,
          );
      }
      (api[entry.group] ??= {})[entry.name] = fn;
    }
    return api;
  };

  const make = (bound: { context: unknown } | undefined): ClientInstance<E> =>
    Object.assign(build(bound), {
      context,
      endpoints,
      bind: (value: unknown) => make({ context: value }),
      realtime: {
        // まだつないでいなければ、送るものはない
        authenticate: (payload: unknown) => connection?.authenticate(payload),
      },
    }) as unknown as ClientInstance<E>;
  return make(undefined);
};
