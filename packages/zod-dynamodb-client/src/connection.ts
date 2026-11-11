/**
 * Realtime Gateway への接続（§10.4）。Client で 1 本だけ持ち、購読がなくなったら閉じる。
 * 切れたら間隔を広げながら再接続し、すべての購読に、1 からやり直すよう知らせる。
 */
import {
  realtimeServerMessageSchema,
  type RealtimeBatchMarker,
  type RealtimeClientMessage,
  type RealtimeServerMessage,
} from "@zodapp/zod-dynamodb";
import { ClientError, type ClientErrorCode } from "./errors";

/** 標準の `WebSocket` のうち、使う部分 */
export type WebSocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
};

export type WebSocketConstructor = new (url: string) => WebSocketLike;

export type RealtimeConnectionOptions = {
  /** Gateway の URL（`wss://…`）。トークンを入れるときは関数にする（接続のたびに呼ぶ） */
  url: string | (() => string | Promise<string>);
  /** 省略すると `globalThis.WebSocket` */
  WebSocket?: WebSocketConstructor;
  /** 再接続の最初の間隔（ミリ秒）。既定は 500。失敗のたびに 2 倍にする */
  reconnectDelay?: number;
  /** 再接続の間隔の上限（ミリ秒）。既定は 30 秒 */
  maxReconnectDelay?: number;
  /** 購読がなくなってから接続を閉じるまでの時間（ミリ秒）。既定は 1 秒 */
  idleTimeout?: number;
};

type PageMessage = Extract<RealtimeServerMessage, { type: "page" }>;
export type ChangeMessage = Extract<RealtimeServerMessage, { type: "change" }>;

/** 購読 1 つが受け取るもの */
export type ChannelHandler = {
  /** 購読の準備ができた。ここからページを頼める */
  onReady(): void;
  onChange(message: ChangeMessage): void;
  onBatch(marker: RealtimeBatchMarker): void;
  /** 購読が終わった（Gateway のエラーなど）。やり直さない */
  onError(error: ClientError): void;
  /** 接続が切れた。再接続したら、また `onReady` が呼ばれる（1 からやり直す） */
  onInterrupted(): void;
};

export type Channel = {
  /** 1 ページを頼む */
  page(cursor: string | undefined, limit: number): Promise<PageMessage>;
  close(): void;
};

type Entry = {
  id: number;
  name: string;
  params: unknown;
  handler: ChannelHandler;
  pendingPage?: {
    resolve: (m: PageMessage) => void;
    reject: (e: unknown) => void;
  };
};

const OPEN = 1;

export const createRealtimeConnection = (
  options: RealtimeConnectionOptions,
) => {
  const WS =
    options.WebSocket ??
    (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
  const baseDelay = options.reconnectDelay ?? 500;
  const maxDelay = options.maxReconnectDelay ?? 30_000;
  const idleTimeout = options.idleTimeout ?? 1_000;
  const entries = new Map<number, Entry>();
  let nextId = 1;
  let socket: WebSocketLike | undefined;
  let open = false;
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let connecting = false;

  const send = (message: RealtimeClientMessage) => {
    if (socket && open && socket.readyState === OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const subscribeMessage = (entry: Entry): RealtimeClientMessage => ({
    type: "subscribe",
    id: entry.id,
    name: entry.name,
    params: entry.params,
  });

  const rejectPage = (entry: Entry, error: unknown) => {
    const pending = entry.pendingPage;
    entry.pendingPage = undefined;
    pending?.reject(error);
  };

  const fail = (entry: Entry, code: ClientErrorCode, message?: string) => {
    entries.delete(entry.id);
    const error = new ClientError(code, message ? { message } : {});
    rejectPage(entry, error);
    entry.handler.onError(error);
    scheduleIdle();
  };

  const onMessage = (data: unknown) => {
    let message: RealtimeServerMessage;
    try {
      message = realtimeServerMessageSchema.parse(
        JSON.parse(String(data)),
      ) as RealtimeServerMessage;
    } catch {
      return; // 知らない形のメッセージは無視する
    }
    if (message.type === "error" && message.id === undefined) return;
    const entry = entries.get(message.id!);
    if (!entry) return;
    switch (message.type) {
      case "ready":
        entry.handler.onReady();
        return;
      case "page": {
        const pending = entry.pendingPage;
        entry.pendingPage = undefined;
        pending?.resolve(message);
        return;
      }
      case "change":
        entry.handler.onChange(message);
        return;
      case "batch":
        entry.handler.onBatch(message.marker);
        return;
      case "error":
        fail(entry, message.code as ClientErrorCode, message.message);
        return;
    }
  };

  const onDisconnected = () => {
    if (!socket) return;
    socket = undefined;
    open = false;
    for (const entry of entries.values()) {
      rejectPage(entry, new ClientError("NETWORK"));
      entry.handler.onInterrupted();
    }
    if (entries.size > 0) scheduleReconnect();
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    const delay = Math.min(maxDelay, baseDelay * 2 ** attempts);
    attempts++;
    const jitter = delay * (0.8 + Math.random() * 0.4);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, jitter);
  };

  const connect = async () => {
    if (socket || connecting || entries.size === 0) return;
    if (!WS) throw new TypeError("WebSocket is not available");
    connecting = true;
    let url: string;
    try {
      url =
        typeof options.url === "function" ? await options.url() : options.url;
    } catch {
      connecting = false;
      scheduleReconnect();
      return;
    }
    connecting = false;
    if (socket || entries.size === 0) return;
    const ws = new WS(url);
    socket = ws;
    ws.onopen = () => {
      if (socket !== ws) return;
      open = true;
      attempts = 0;
      for (const entry of entries.values()) send(subscribeMessage(entry));
    };
    ws.onmessage = (event) => {
      if (socket === ws) onMessage(event.data);
    };
    ws.onclose = () => {
      if (socket === ws) onDisconnected();
    };
    ws.onerror = () => {
      // close も続けて呼ばれる
    };
  };

  const scheduleIdle = () => {
    if (entries.size > 0 || idleTimer) return;
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (entries.size > 0) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      const ws = socket;
      socket = undefined;
      open = false;
      ws?.close(1000, "idle");
    }, idleTimeout);
  };

  return {
    /**
     * 認証の情報を、同じ接続のまま入れ替える（`auth` メッセージ）。`payload` の形はアプリが決める。
     * 接続していなければ何もしない（次につなぐときは `url` で認証の情報を渡す）。
     * Gateway が受け付けられなければ、接続が閉じられ、つながり直す
     */
    authenticate(payload: unknown): void {
      send({ type: "auth", payload });
    },
    /** 購読を始める。接続がなければつなぐ */
    open(name: string, params: unknown, handler: ChannelHandler): Channel {
      const entry: Entry = { id: nextId++, name, params, handler };
      entries.set(entry.id, entry);
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
      if (open) send(subscribeMessage(entry));
      else void connect();
      return {
        page: (cursor, limit) =>
          new Promise<PageMessage>((resolve, reject) => {
            if (!entries.has(entry.id) || !open) {
              reject(new ClientError("NETWORK"));
              return;
            }
            rejectPage(entry, new Error("superseded"));
            entry.pendingPage = { resolve, reject };
            send({
              type: "page",
              id: entry.id,
              limit,
              ...(cursor ? { cursor } : {}),
            });
          }),
        close: () => {
          if (!entries.delete(entry.id)) return;
          rejectPage(entry, new Error("closed"));
          send({ type: "unsubscribe", id: entry.id });
          scheduleIdle();
        },
      };
    },
  };
};

export type RealtimeConnection = ReturnType<typeof createRealtimeConnection>;
