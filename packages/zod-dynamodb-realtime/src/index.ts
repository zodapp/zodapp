/**
 * Realtime Gateway（§9.6、K5、K9）。WebSocket で Client の購読を受け、配送基盤のトピックを購読して、
 * 範囲の条件（`matches`）に合う変更だけを転送する。ページは同じ WebSocket で 1 ページずつ返す。
 *
 * Gateway は progressive か全体か、どこまで読み込んだかを知らず、バッファも持たない（K5 B'）。
 */
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import {
  classifyChange,
  DefinitionError,
  ERROR_MESSAGES,
  pickFields,
  realtimeClientMessageSchema,
  toErrorBody,
  topicForSubscriber,
  topicMessageCodec,
  type AnySubscriptionDef,
  type AnyTableConfig,
  type ErrorCode,
  type OpRequest,
  type RealtimeServerMessage,
  type ResolvedEntry,
  subscriptionId,
  type RealtimeTransport,
  type TopicMessage,
} from "@zodapp/zod-dynamodb";
import { runWithContext, type Repository } from "@zodapp/zod-dynamodb-node";
import { WebSocketServer, type WebSocket } from "ws";
import type { z } from "zod";

/** Repository のうち、Gateway が使う部分 */
export type AnyRepository = Pick<Repository<{}>, "forTable"> & {
  readonly $context?: unknown;
};

/** 公開する購読 1 件。認可は `api.authorize`（拒否は `ForbiddenError` を投げる） */
type GatewaySubscription = {
  subscription: AnySubscriptionDef;
  authorize: (
    context: unknown,
    request: { name: string; params: unknown },
  ) => boolean;
};

export const DEFAULT_MAX_PAGE_SIZE = 1_000;
export const DEFAULT_REBUILD_AT = 0.8;
export const DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION = 100;
export const DEFAULT_MAX_CONCURRENT_REBUILDS = 10;

/** `FORBIDDEN` になるエラー（エラーコードはクラスの名前で決まる） */
const forbidden = () =>
  Object.assign(new Error("forbidden"), { name: "ForbiddenError" });

const entityOf = (raw: string): unknown => {
  try {
    return (JSON.parse(raw) as { entity?: unknown }).entity;
  } catch {
    return undefined;
  }
};

/** Gateway の内部の設定（`fromApi` が作る） */
type GatewayConfig = {
  repository: AnyRepository;
  transport: RealtimeTransport;
  /** upgrade のリクエストから認証の情報を取り出す。ライブラリは中身を見ない */
  credential: (req: IncomingMessage) => unknown;
  /** 認証の情報から認証コンテキストを作る。upgrade のときに投げたら 401 で拒否し、接続の途中なら接続を閉じる */
  context: (credential: unknown) => unknown;
  /** 認証コンテキストがまだ使えるか（期限など）を確かめる。使えなければ投げる */
  checkContext: (context: unknown) => void;
  /** 認証コンテキストの期限（ミリ秒の時刻）。`undefined` なら期限なし */
  expiresAt: (context: unknown) => number | undefined;
  /** 公開する Subscription。キーが Client の指定する名前（グループ名.操作の名前） */
  subscriptions: Record<string, GatewaySubscription>;
  /** 1 ページの件数の上限（K6）。既定は 1,000 */
  maxPageSize?: number;
  /** トピック名の先頭（書き込み側と揃える） */
  prefix?: string;
  /** `INTERNAL` にしたエラーと、配送の失敗。既定はログに出す */
  onError?: (error: unknown) => void;
  /** 生存確認の ping の間隔（ミリ秒）。既定は 30 秒。0 で送らない */
  pingInterval?: number;
  /**
   * 認証コンテキストを作り直す時点。コンテキストの寿命（作った時刻から期限まで）に対する割合。既定は 0.8。
   * 覚えている認証の情報から作り直し、作れなければ接続を閉じる
   */
  rebuildAt?: number;
  /** コンテキストの作り直し（期限の前、`auth` メッセージ、`revalidate`）を同時に行う数の上限。既定は 10 */
  maxConcurrentRebuilds?: number;
  /**
   * `auth` メッセージの `payload` を、認証の情報（`createServerApi` の `credential` が返すのと同じ型）に直す。
   * 検証もここで行い、正しくなければ投げる（接続を閉じる）。
   * 渡さなければ `auth` メッセージは受け付けない（Cookie や証明書のように、ブラウザから値を送れない方式では、
   * 期限が来たらつながり直して、upgrade のリクエストで新しい認証の情報を渡す）
   */
  credentialOf?: (payload: unknown) => unknown;
  /**
   * upgrade のリクエストの Origin ヘッダーを確かめる。オリジンの配列（完全一致）か、判定の関数。
   * 許可しなければ、認証コンテキストを作る前に 403 で拒否する。
   * Origin ヘッダーのないリクエスト（ブラウザ以外のクライアント）は通す（関数も呼ばない）。
   * 省略すれば確かめない。Cookie で認証するアプリでは、Cross-Site WebSocket Hijacking を防ぐために指定する
   */
  origin?:
    readonly string[] | ((origin: string, req: IncomingMessage) => boolean);
  /** 1 本の接続で同時に持てる購読の数（認可の途中のものも含む）。既定は 100。超えた購読は INVALID_INPUT で拒否する */
  maxSubscriptionsPerConnection?: number;
};

/** サーバーの API（`createServerApi`）のうち、Gateway が使う部分 */
export type GatewayApi = {
  readonly endpoints: { readonly entries: readonly ResolvedEntry[] };
  readonly repository: AnyRepository;
  contextOf(req: IncomingMessage): Promise<unknown>;
  /** `createServerApi` に `context` を渡したか */
  readonly hasContext: boolean;
  credentialFromRequest(req: IncomingMessage): unknown;
  contextFromCredential(credential: unknown): Promise<unknown>;
  checkContext(context: unknown): void;
  expiresAt(context: unknown): number | undefined;
  authorize(
    entry: ResolvedEntry,
    request: OpRequest,
    options?: { context?: unknown },
  ): unknown;
};

/** Gateway の設定 */
export type RealtimeGatewayOptions = Omit<
  GatewayConfig,
  | "repository"
  | "credential"
  | "context"
  | "checkContext"
  | "expiresAt"
  | "subscriptions"
> & {
  /**
   * サーバーの API。登録簿で `live` を付けたクエリだけを、「グループ名.操作の名前」で受け付ける。
   * 認証コンテキストは `createServerApi` の `context` で作り、認可は操作の `authorize`（上書きを含む）で行う
   */
  api: GatewayApi;
};

/** サーバーの API から、Gateway の設定を作る */
const fromApi = (options: RealtimeGatewayOptions): GatewayConfig => {
  const { api, ...rest } = options;
  if (!api.hasContext && api.endpoints.entries.some((e) => e.subscription)) {
    throw new DefinitionError(
      "createRealtimeGateway needs the context option of createServerApi to serve live queries",
    );
  }
  const subscriptions: Record<string, GatewaySubscription> = {};
  for (const entry of api.endpoints.entries) {
    if (!entry.subscription) continue;
    subscriptions[subscriptionId(entry)] = {
      subscription: entry.subscription,
      // 拒否は ForbiddenError（FORBIDDEN）、期限切れなどは UnauthenticatedError として返る
      // （`api.authorize` は、認可の前に期限と `checkContext` を確かめる）
      authorize: (context, { params }) => {
        api.authorize(entry, { params }, { context });
        return true;
      },
    };
  }
  return {
    ...rest,
    repository: api.repository,
    credential: (req) => api.credentialFromRequest(req),
    context: (credential) => api.contextFromCredential(credential),
    checkContext: (context) => api.checkContext(context),
    expiresAt: (context) => api.expiresAt(context),
    subscriptions,
  };
};

export type RealtimeGateway = {
  /** HTTP サーバーの upgrade のうち、`path` に一致するものを受ける */
  attach(server: Server, options: { path: string }): void;
  /** upgrade を 1 件処理する（`attach` を使わないとき） */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  /**
   * 接続の認証コンテキストを、最後に受け取った認証の情報（upgrade のとき、または最後の `auth` メッセージ）
   * から作り直す。緊急のとき（メンバーから外した、アカウントを止めたなど）に使う。
   * `filter` に合う接続だけ（省けばすべて）。作り直せない接続は閉じ、認可の通らない購読は `FORBIDDEN` で止める
   */
  revalidate(filter?: (context: any) => boolean): Promise<void>;
  /** すべての接続を閉じ、配送の購読をやめ、配送を閉じる */
  close(): Promise<void>;
};

type Sub = {
  readonly id: number;
  readonly conn: Connection;
  readonly name: string;
  readonly def: AnySubscriptionDef;
  readonly params: unknown;
  readonly topic: string;
  active: boolean;
};

type Connection = {
  readonly ws: WebSocket;
  /** 最後に受け取った認証の情報（`revalidate` で使う。中身は見ない） */
  credential: unknown;
  context: unknown;
  /** 認証の情報を受け取るたびに増やす（古い作り直しの結果を捨てるため） */
  generation: number;
  closed: boolean;
  /** 期限の前の作り直しのタイマー */
  rebuildTimer?: ReturnType<typeof setTimeout>;
  readonly subs: Map<number, Sub>;
  alive: boolean;
};

/** 接続を閉じるときのコード（認証の失敗）。Client はつながり直す */
export const CLOSE_UNAUTHENTICATED = 4401;

type Topic = {
  readonly subs: Set<Sub>;
  /** 配送基盤の購読（SUBACK を待つ） */
  ready: Promise<void>;
};

/**
 * Realtime Gateway を作る（§9.6）。
 *
 * ```ts
 * const realtime = createRealtimeGateway({
 *   api: serverApi, // createServerApi(endpoints, { repository, context })
 *   transport: mqttTransport({ url: process.env.MQTT_URL! }),
 * });
 * realtime.attach(server, { path: "/api/realtime" });
 * ```
 */
export function createRealtimeGateway(
  input: RealtimeGatewayOptions,
): RealtimeGateway {
  if (!input?.api) {
    throw new TypeError("createRealtimeGateway: api is required");
  }
  const options = fromApi(input);
  const entries = options.subscriptions;
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const maxSubscriptions =
    options.maxSubscriptionsPerConnection ??
    DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION;
  /** upgrade の Origin ヘッダーを許可するか。ヘッダーがなければ通す */
  const originAllowed = (req: IncomingMessage): boolean => {
    const allow = options.origin;
    const origin = req.headers.origin;
    if (allow === undefined || origin === undefined) return true;
    if (typeof allow === "function") {
      try {
        return allow(origin, req) === true;
      } catch (error) {
        report(error);
        return false;
      }
    }
    return allow.includes(origin);
  };
  const report = options.onError ?? ((e: unknown) => console.error(e));
  const transport = options.transport;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const connections = new Set<Connection>();
  const topics = new Map<string, Topic>();
  const decoders = new Map<
    AnyTableConfig,
    ReturnType<typeof topicMessageCodec>
  >();
  const decoderOf = (table: AnyTableConfig) => {
    let codec = decoders.get(table);
    if (!codec) {
      codec = topicMessageCodec(table);
      decoders.set(table, codec);
    }
    return codec;
  };

  const send = (conn: Connection, message: RealtimeServerMessage) => {
    if (conn.ws.readyState === conn.ws.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  };

  const sendError = (
    conn: Connection,
    id: number | undefined,
    code: ErrorCode,
    message = ERROR_MESSAGES[code],
  ) =>
    send(conn, {
      type: "error",
      ...(id === undefined ? {} : { id }),
      code,
      message,
    });

  // ---- トピックの参照 ----

  const onTopicMessage = (topic: string, raw: string) => {
    const entry = topics.get(topic);
    if (!entry) return;
    // トピックに来たメッセージを、購読ごとに判定して送る
    const decoded = new Map<AnyTableConfig, TopicMessage | null>();
    for (const sub of entry.subs) {
      if (!sub.active) continue;
      let message = decoded.get(sub.def.table);
      if (message === undefined) {
        try {
          message = decoderOf(sub.def.table).decode(raw);
        } catch (error) {
          // 別のエンティティのメッセージ（ハッシュの衝突）は黙って捨てる。形が合わないものは報告する
          message = null;
          if (entityOf(raw) === sub.def.table._compiled.entity) report(error);
        }
        decoded.set(sub.def.table, message);
      }
      if (message) deliver(sub, message);
    }
  };

  /** 配信の前に、いまの認証コンテキストで認可し直す（同期。データベースは読まない） */
  const deliver = (sub: Sub, message: TopicMessage) => {
    if (!sub.active || !reauthorize(sub)) return;
    deliverNow(sub, message);
  };

  const deliverNow = (sub: Sub, message: TopicMessage) => {
    if (message.type === "batch") {
      const m = message.marker;
      send(sub.conn, {
        type: "batch",
        id: sub.id,
        marker: {
          type: m.type,
          origin: m.origin,
          ...(m.type === "BATCH_FINISHED"
            ? { count: m.count, status: m.status }
            : {}),
        },
      });
      return;
    }
    try {
      const change = classifyChange(
        sub.def.query,
        sub.params,
        message,
        sub.conn.context,
      );
      if (!change) return;
      const item =
        change === "REMOVED"
          ? undefined
          : sub.def.encodeItem(
              sub.def.fields
                ? pickFields(message.after!, sub.def.fields)
                : message.after,
            );
      send(sub.conn, {
        type: "change",
        id: sub.id,
        change,
        key: sub.def.encodeKey(message.key),
        ...(item === undefined ? {} : { item }),
        version: message.version,
        origin: message.origin,
      });
    } catch (error) {
      // 書き込み側のフィールドの指定が Subscription と合っていないなど
      report(error);
    }
  };

  const acquire = (sub: Sub): Promise<void> => {
    let entry = topics.get(sub.topic);
    if (!entry) {
      const created: Topic = { subs: new Set(), ready: Promise.resolve() };
      created.ready = transport.subscribe(sub.topic, (m) =>
        onTopicMessage(sub.topic, m),
      );
      created.ready.catch(() => {
        if (topics.get(sub.topic) === created) topics.delete(sub.topic);
      });
      topics.set(sub.topic, created);
      entry = created;
    }
    entry.subs.add(sub);
    return entry.ready;
  };

  const release = (sub: Sub) => {
    sub.active = false;
    sub.conn.subs.delete(sub.id);
    const entry = topics.get(sub.topic);
    if (!entry) return;
    entry.subs.delete(sub);
    if (entry.subs.size === 0) {
      topics.delete(sub.topic);
      // 購読の途中で解除されたときは、購読が終わってからやめる
      entry.ready
        .then(() =>
          topics.has(sub.topic) ? undefined : transport.unsubscribe(sub.topic),
        )
        .catch(report);
    }
  };

  // ---- メッセージ ----

  /** 認証の失敗：エラーを送って接続を閉じる。Client はつながり直し、そこで新しい認証の情報を渡す */
  const closeUnauthenticated = (conn: Connection) => {
    if (conn.closed) return;
    conn.closed = true;
    for (const sub of [...conn.subs.values()]) release(sub);
    sendError(conn, undefined, "UNAUTHENTICATED");
    conn.ws.close(CLOSE_UNAUTHENTICATED, "unauthenticated");
  };

  /** 購読 1 つを止める。認証の失敗なら接続ごと閉じる */
  const fail = (conn: Connection, id: number, error: unknown) => {
    const body = toErrorBody(error);
    if (body.code === "UNAUTHENTICATED") return closeUnauthenticated(conn);
    const sub = conn.subs.get(id);
    if (sub) release(sub);
    if (body.code === "INTERNAL") report(error);
    sendError(conn, id, body.code);
  };

  /** 購読を、いまの認証コンテキストで認可する。通らなければ購読を止めて false */
  const reauthorize = (sub: Sub): boolean => {
    const { conn } = sub;
    const entry = entries[sub.name]!;
    try {
      const allowed = runWithContext(conn.context, () =>
        entry.authorize(conn.context, { name: sub.name, params: sub.params }),
      );
      if (!sub.active) return false;
      if (allowed !== true) {
        fail(conn, sub.id, forbidden());
        return false;
      }
      return true;
    } catch (error) {
      if (sub.active) fail(conn, sub.id, error);
      return false;
    }
  };

  /** 作り直しの同時実行数の上限。超えた分は順に待つ */
  const maxRebuilds = Math.max(
    1,
    options.maxConcurrentRebuilds ?? DEFAULT_MAX_CONCURRENT_REBUILDS,
  );
  let runningRebuilds = 0;
  const waitingRebuilds: (() => void)[] = [];
  const withRebuildSlot = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (runningRebuilds >= maxRebuilds) {
      await new Promise<void>((resolve) => waitingRebuilds.push(resolve));
    } else {
      runningRebuilds++;
    }
    try {
      return await fn();
    } finally {
      const next = waitingRebuilds.shift();
      // 待っている作り直しに、枠をそのまま渡す
      if (next) next();
      else runningRebuilds--;
    }
  };

  /** 期限の前（寿命の `rebuildAt` の時点）に、覚えている認証の情報から作り直す */
  const rebuildAt = options.rebuildAt ?? DEFAULT_REBUILD_AT;
  const scheduleRebuild = (conn: Connection, previousExpiry?: number) => {
    clearTimeout(conn.rebuildTimer);
    conn.rebuildTimer = undefined;
    if (conn.closed) return;
    const expiry = options.expiresAt(conn.context);
    if (expiry === undefined) return;
    // 作り直しても期限が延びなかった（認証の情報そのものの期限が近い）ら、もう作り直さない。
    // 期限が来たら次の操作で接続を閉じ、Client がつながり直すか、`auth` メッセージで入れ替える
    if (previousExpiry !== undefined && expiry <= previousExpiry) return;
    const now = Date.now();
    const delay = Math.max(0, (expiry - now) * rebuildAt);
    conn.rebuildTimer = setTimeout(() => {
      conn.rebuildTimer = undefined;
      void refresh(conn, conn.credential).catch(report);
    }, delay);
    conn.rebuildTimer.unref?.();
  };

  /**
   * 認証の情報から認証コンテキストを作り直し、開いている購読をすべて認可し直す
   * （期限の前、`auth` メッセージ、`revalidate`）。作れなければ接続を閉じる。
   * 作り直しの間に届いた変更は、前のコンテキスト（まだ期限内）で配信する
   */
  const refresh = (conn: Connection, credential: unknown) => {
    const generation = ++conn.generation;
    return withRebuildSlot(() => refreshNow(conn, credential, generation));
  };

  const refreshNow = async (
    conn: Connection,
    credential: unknown,
    generation: number,
  ) => {
    if (generation !== conn.generation || conn.closed) return;
    let context: unknown;
    try {
      context = await options.context(credential);
      options.checkContext(context);
    } catch {
      if (generation === conn.generation) closeUnauthenticated(conn);
      return;
    }
    if (generation !== conn.generation || conn.closed) return;
    // 同じ認証の情報から作り直したときだけ、期限が延びたかを見る
    const previousExpiry =
      credential === conn.credential
        ? options.expiresAt(conn.context)
        : undefined;
    conn.credential = credential;
    conn.context = context;
    scheduleRebuild(conn, previousExpiry);
    await Promise.all(
      [...conn.subs.values()]
        .filter((sub) => sub.active)
        .map(async (sub) => {
          if (!reauthorize(sub)) return;
          // 範囲が認証コンテキストで決まる購読（「自分の担当」など）は、範囲が変わったら続けられない
          const topic = await topicForSubscriber(sub.def, sub.params, context, {
            prefix: options.prefix,
          }).catch(() => undefined);
          if (sub.active && topic !== sub.topic) {
            fail(conn, sub.id, forbidden());
          }
        }),
    );
  };

  const subscribe = async (
    conn: Connection,
    id: number,
    name: string,
    rawParams: unknown,
  ) => {
    const entry = Object.hasOwn(entries, name) ? entries[name] : undefined;
    if (!entry)
      return sendError(
        conn,
        id,
        "INVALID_INPUT",
        `unknown subscription "${name}"`,
      );
    if (conn.subs.has(id)) {
      return sendError(
        conn,
        id,
        "INVALID_INPUT",
        `subscription ${id} already exists`,
      );
    }
    if (conn.subs.size >= maxSubscriptions) {
      return sendError(
        conn,
        id,
        "INVALID_INPUT",
        "too many subscriptions on this connection",
      );
    }
    const def = entry.subscription;
    let params: unknown;
    try {
      params = def.decodeParams(rawParams);
    } catch {
      return sendError(conn, id, "INVALID_INPUT");
    }
    // 認可の結果が出るまでに届いたページの依頼などに備えて、先に登録しておく
    const pending: Sub = {
      id,
      conn,
      name,
      def,
      params,
      topic: "",
      active: false,
    };
    conn.subs.set(id, pending);
    let topic: string;
    try {
      // 認可の途中で認証コンテキストが入れ替わったら、新しいコンテキストでやり直す
      for (;;) {
        const context = conn.context;
        const allowed = entry.authorize(context, { name, params });
        if (conn.subs.get(id) !== pending) return; // 途中で解除された
        if (allowed !== true) {
          conn.subs.delete(id);
          return sendError(conn, id, "FORBIDDEN");
        }
        topic = await topicForSubscriber(def, params, context, {
          prefix: options.prefix,
        });
        if (conn.context === context) break;
      }
    } catch (error) {
      if (conn.subs.get(id) === pending) conn.subs.delete(id);
      return fail(conn, id, error);
    }
    if (conn.subs.get(id) !== pending) return;
    const sub: Sub = { ...pending, topic, active: true };
    conn.subs.set(id, sub);
    try {
      await acquire(sub);
    } catch (error) {
      return fail(conn, id, error);
    }
    if (sub.active) send(conn, { type: "ready", id });
  };

  const page = async (
    conn: Connection,
    id: number,
    cursor: string | undefined,
    limit: number,
  ) => {
    const sub = conn.subs.get(id);
    if (!sub?.active) {
      return sendError(
        conn,
        id,
        "INVALID_INPUT",
        `subscription ${id} is not ready`,
      );
    }
    if (!reauthorize(sub)) return;
    try {
      const res = await options.repository
        .forTable(sub.def.table as never)
        .query(sub.def.query as never, sub.params as never, {
          cursor,
          limit: Math.min(limit, maxPageSize),
          context: conn.context as never,
          withVersions: true,
        });
      if (!sub.active) return;
      const items = (res.items as Record<string, unknown>[]).map((item, i) => ({
        item: sub.def.encodeItem(
          sub.def.fields ? pickFields(item, sub.def.fields) : item,
        ),
        version: res.versions![i]!,
      }));
      send(conn, {
        type: "page",
        id,
        items,
        ...(res.cursor ? { cursor: res.cursor } : {}),
      });
    } catch (error) {
      if (sub.active) fail(conn, id, error);
    }
  };

  const onMessage = (conn: Connection, data: unknown) => {
    let message: z.infer<typeof realtimeClientMessageSchema>;
    try {
      message = realtimeClientMessageSchema.parse(JSON.parse(String(data)));
    } catch {
      return sendError(conn, undefined, "INVALID_INPUT");
    }
    if (conn.closed) return;
    switch (message.type) {
      // 処理の間は、接続の認証コンテキストのスコープを張る
      case "subscribe":
        void runWithContext(conn.context, () =>
          subscribe(conn, message.id, message.name, message.params),
        ).catch(report);
        return;
      case "page":
        void runWithContext(conn.context, () =>
          page(conn, message.id, message.cursor, message.limit),
        ).catch(report);
        return;
      case "unsubscribe": {
        const sub = conn.subs.get(message.id);
        if (sub) release(sub);
        return;
      }
      case "auth": {
        const credentialOf = options.credentialOf;
        if (!credentialOf) {
          return sendError(
            conn,
            undefined,
            "INVALID_INPUT",
            "auth messages are not accepted",
          );
        }
        const generation = conn.generation;
        void Promise.resolve()
          .then(() => credentialOf(message.payload))
          .then(
            (credential) => refresh(conn, credential),
            () => {
              if (generation === conn.generation) closeUnauthenticated(conn);
            },
          )
          .catch(report);
        return;
      }
    }
  };

  const onConnection = (
    ws: WebSocket,
    credential: unknown,
    context: unknown,
  ) => {
    const conn: Connection = {
      ws,
      credential,
      context,
      generation: 0,
      closed: false,
      subs: new Map(),
      alive: true,
    };
    connections.add(conn);
    scheduleRebuild(conn);
    ws.on("message", (data) => onMessage(conn, data));
    ws.on("pong", () => {
      conn.alive = true;
    });
    ws.on("close", () => {
      conn.closed = true;
      clearTimeout(conn.rebuildTimer);
      connections.delete(conn);
      for (const sub of [...conn.subs.values()]) release(sub);
    });
    ws.on("error", report);
  };

  const pingInterval = options.pingInterval ?? 30_000;
  const pinger =
    pingInterval > 0
      ? setInterval(() => {
          for (const conn of connections) {
            if (!conn.alive) {
              conn.ws.terminate();
              continue;
            }
            conn.alive = false;
            conn.ws.ping();
          }
        }, pingInterval)
      : undefined;
  pinger?.unref?.();

  const handleUpgrade = (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    if (!originAllowed(req)) {
      socket.end(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
      );
      return;
    }
    Promise.resolve()
      .then(async () => {
        const credential = options.credential(req);
        const context = await options.context(credential);
        options.checkContext(context);
        return { credential, context };
      })
      .then(
        ({ credential, context }) =>
          wss.handleUpgrade(req, socket, head, (ws) =>
            onConnection(ws, credential, context),
          ),
        () => {
          socket.end(
            "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
          );
        },
      )
      .catch((error: unknown) => {
        report(error);
        socket.destroy();
      });
  };

  return {
    attach: (server, { path }) => {
      server.on(
        "upgrade",
        (req: IncomingMessage, socket: Duplex, head: Buffer) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (url.pathname === path) handleUpgrade(req, socket, head);
        },
      );
    },
    handleUpgrade,
    revalidate: async (filter) => {
      const targets = [...connections].filter(
        (conn) => !conn.closed && (!filter || filter(conn.context)),
      );
      await Promise.all(targets.map((conn) => refresh(conn, conn.credential)));
    },
    close: async () => {
      if (pinger) clearInterval(pinger);
      for (const conn of connections) {
        clearTimeout(conn.rebuildTimer);
        conn.ws.close(1001, "server closing");
      }
      for (const conn of connections) {
        for (const sub of [...conn.subs.values()]) release(sub);
      }
      connections.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await transport.close();
    },
  };
}
