/**
 * リアルタイムの一覧の store（§10、K5 B'）。Gateway の「購読」と「ページ」から、Client で一覧を組み立てる。
 *
 * 1. `subscribe` を送り、`ready` を待つ。届いた変更は、キーごとに最新の `version` と値（削除なら Tombstone）として覚える
 * 2. ページを頼み、届いた Item と覚えていた変更を `version` で突き合わせる
 * 3. 全体の購読は最後のページまで自動で読む。progressive は `fetchMore` のときだけ次のページを読む
 * 4. 一覧に出すのは、ウィンドウ（最後に読んだページの境界まで）の中だけ
 * 5. 接続が切れたら、1 からやり直す（Tombstone は残す。読み直すまでは前の一覧を出したまま）
 */
import {
  compareKeyStrings,
  composeKey,
  type AnySubscriptionDef,
  type KeyPart,
  type RealtimeBatchMarker,
} from "@zodapp/zod-dynamodb";
import type { Channel, ChangeMessage, RealtimeConnection } from "./connection";
import { ClientError, isClientError } from "./errors";
import {
  createState,
  DEFAULT_MAX_SNAPSHOT_ITEMS,
  type ListOptions,
  type ListState,
  type ListStore,
} from "./store";

export type LiveListOptions = ListOptions & {
  /**
   * 一括での書き込み（§11.5）の扱い。`"apply"`（既定）は個々の変更を適用する。
   * `"reload"` は開始から終了までの変更を適用せずに待ち、終了で読み直す
   */
  onBatch?: "apply" | "reload";
};

/** ウィンドウの外の変更を覚えておく時間（K5） */
export const OUT_OF_WINDOW_RETENTION_MS = 60_000;
const SWEEP_INTERVAL_MS = 10_000;

type Entry<T> = {
  /** `null` は Tombstone */
  item: T | null;
  version: number;
  /** 最後に変わった時刻 */
  at: number;
  /** Index の Sort Key（物理キーの文字列）。分からなければ `undefined` */
  sortKey: string | undefined;
  /** ベーステーブルのキー（同じ Sort Key の Item の並びを決める） */
  primaryKey: string;
};

type Position = { sortKey: string; primaryKey: string };

export type LiveListDeps = {
  connection: RealtimeConnection;
  name: string;
  subscription: AnySubscriptionDef;
  /** テスト用 */
  now?: () => number;
};

export const createLiveListStore = <T>(
  deps: LiveListDeps,
  params: unknown,
  options: LiveListOptions = {},
): ListStore<T> => {
  const { connection, name, subscription: def } = deps;
  const now = deps.now ?? Date.now;
  const query = def.query;
  const compiled = def.table._compiled;
  const entity = compiled.entity;
  const sortPart: KeyPart =
    query.index === undefined
      ? compiled.key.sort
      : compiled.indexes.get(query.index)!.sort;
  const desc = query.direction === "desc";
  const progressive = options.pageSize !== undefined;
  const pageSize = options.pageSize ?? DEFAULT_MAX_SNAPSHOT_ITEMS;
  const max = options.maxSnapshotItems ?? DEFAULT_MAX_SNAPSHOT_ITEMS;

  const store = createState<ListState<T>>({
    status: "loading",
    items: [],
    hasMore: false,
    isFetchingMore: false,
  });

  let known = new Map<string, Entry<T>>();
  let channel: Channel | undefined;
  /** やり直しのたびに増やす。古い読み込みの結果を捨てる */
  let session = 0;
  let cursor: string | undefined;
  let boundary: Position | undefined;
  /** これまでに読んだ件数（再接続のあと、そこまで読み直す） */
  let loadedCount = 0;
  /** 読み直しの途中。前の一覧を出したままにする */
  let frozen = true;
  let closed = false;
  /** `start` のたびに増やす。前の購読から届いたものを捨てる */
  let startToken = 0;
  const pausedOrigins = new Set<string>();

  const primaryKeyOf = (value: Record<string, unknown>) =>
    `${composeKey(entity, compiled.key.partition, value)}\u0000${composeKey(entity, compiled.key.sort, value)}`;
  const sortKeyOf = (item: Record<string, unknown>) =>
    composeKey(entity, sortPart, item);

  /** 一覧の順で a が b より前なら負 */
  const order = (a: Position, b: Position) => {
    const c =
      compareKeyStrings(a.sortKey, b.sortKey) ||
      (a.primaryKey < b.primaryKey ? -1 : a.primaryKey > b.primaryKey ? 1 : 0);
    return desc ? -c : c;
  };

  const inWindow = (e: Entry<T>) => {
    if (e.sortKey === undefined) return false;
    if (cursor === undefined || boundary === undefined) return true;
    return (
      order({ sortKey: e.sortKey, primaryKey: e.primaryKey }, boundary) <= 0
    );
  };

  const sweep = () => {
    const limit = now() - OUT_OF_WINDOW_RETENTION_MS;
    let removed = false;
    for (const [k, e] of known) {
      if (e.at < limit && !inWindow(e)) {
        known.delete(k);
        removed = true;
      }
    }
    return removed;
  };

  const publish = () => {
    if (frozen || closed) return;
    sweep();
    const visible = [...known.values()]
      .filter((e) => e.item !== null && inWindow(e))
      .sort((a, b) =>
        order(
          { sortKey: a.sortKey!, primaryKey: a.primaryKey },
          { sortKey: b.sortKey!, primaryKey: b.primaryKey },
        ),
      );
    store.set({
      status: "ready",
      items: visible.map((e) => e.item!),
      hasMore: cursor !== undefined,
    });
  };

  const fail = (error: unknown) => {
    session++;
    channel?.close();
    channel = undefined;
    frozen = true;
    store.set({
      status: "error",
      isFetchingMore: false,
      error:
        error instanceof Error ? error : new ClientError("INVALID_RESPONSE"),
    });
  };

  /** 値を、`version` が新しいときだけ覚える */
  const remember = (
    key: string,
    item: T | null,
    version: number,
    sortKey: string | undefined,
  ) => {
    const existing = known.get(key);
    if (existing && existing.version >= version) return false;
    known.set(key, {
      item,
      version,
      at: now(),
      sortKey: sortKey ?? existing?.sortKey,
      primaryKey: key,
    });
    return true;
  };

  const mergePage = (page: {
    items: { item: unknown; version: number }[];
    cursor?: string;
  }) => {
    for (const { item: json, version } of page.items) {
      const item = def.decodeItem(json) as Record<string, unknown>;
      remember(primaryKeyOf(item), item as T, version, sortKeyOf(item));
    }
    loadedCount += page.items.length;
    cursor = page.cursor;
    const last = page.items.at(-1);
    if (last) {
      const item = def.decodeItem(last.item) as Record<string, unknown>;
      boundary = { sortKey: sortKeyOf(item)!, primaryKey: primaryKeyOf(item) };
    }
  };

  const decodeError = (error: unknown) =>
    isClientError(error)
      ? error
      : new ClientError("INVALID_RESPONSE", { cause: error });

  /** 最初のページから読む。progressive では、それまでに読んだ件数まで読み直す */
  const loadInitial = async (s: number) => {
    const target = progressive ? Math.max(pageSize, loadedCount) : Infinity;
    cursor = undefined;
    boundary = undefined;
    loadedCount = 0;
    try {
      do {
        const ch = channel;
        if (!ch) return;
        const page = await ch.page(cursor, progressive ? pageSize : max + 1);
        if (s !== session) return;
        mergePage(page);
        if (!progressive && loadedCount > max) {
          throw new ClientError("TOO_MANY_ITEMS");
        }
      } while (cursor !== undefined && loadedCount < target);
    } catch (error) {
      if (s !== session) return;
      // 接続が切れたときは、再接続でやり直す
      if (isClientError(error, "NETWORK")) return;
      fail(decodeError(error));
      return;
    }
    frozen = false;
    store.set({ isFetchingMore: false, error: undefined });
    publish();
  };

  /** 購読はそのままで、Tombstone を残して読み直す */
  const restartPages = () => {
    const s = ++session;
    frozen = true;
    known = new Map([...known].filter(([, e]) => e.item === null));
    void loadInitial(s);
  };

  const onChange = (m: ChangeMessage) => {
    if (pausedOrigins.has(m.origin.id)) return;
    try {
      if (m.change === "REMOVED") {
        const key = primaryKeyOf(
          def.decodeKey(m.key) as Record<string, unknown>,
        );
        remember(key, null, m.version, undefined);
      } else {
        const item = def.decodeItem(m.item) as Record<string, unknown>;
        remember(primaryKeyOf(item), item as T, m.version, sortKeyOf(item));
      }
    } catch (error) {
      fail(decodeError(error));
      return;
    }
    publish();
  };

  const onBatch = (marker: RealtimeBatchMarker) => {
    if (options.onBatch !== "reload") return;
    if (marker.type === "BATCH_STARTED") {
      pausedOrigins.add(marker.origin.id);
      return;
    }
    pausedOrigins.delete(marker.origin.id);
    restartPages();
  };

  const start = () => {
    let encoded: unknown;
    try {
      encoded = def.encodeParams(params as never);
    } catch (error) {
      store.set({
        status: "error",
        error: new ClientError("INVALID_INPUT", {
          issues: (error as { issues?: never }).issues,
          cause: error,
        }),
      });
      return;
    }
    const token = ++startToken;
    const current = () => token === startToken && !closed;
    frozen = true;
    channel = connection.open(name, encoded, {
      onReady: () => {
        if (!current()) return;
        const s = ++session;
        void loadInitial(s);
      },
      onChange: (m) => {
        if (current()) onChange(m);
      },
      onBatch: (marker) => {
        if (current()) onBatch(marker);
      },
      onError: (error) => {
        if (!current()) return;
        channel = undefined;
        fail(error);
      },
      onInterrupted: () => {
        if (!current()) return;
        // 読み込みの途中なら捨てる。再接続して ready が来たら、Tombstone を残して読み直す。
        // それまでは前の一覧を出したままにする
        session++;
        frozen = true;
        known = new Map([...known].filter(([, e]) => e.item === null));
        store.set({ isFetchingMore: false });
      },
    });
  };

  const sweeper = progressive
    ? setInterval(() => {
        if (!frozen && sweep()) publish();
      }, SWEEP_INTERVAL_MS)
    : undefined;
  (sweeper as { unref?: () => void } | undefined)?.unref?.();

  start();

  return {
    getState: store.get,
    subscribe: store.subscribe,
    fetchMore: () => {
      const st = store.get();
      if (
        !progressive ||
        frozen ||
        st.status !== "ready" ||
        cursor === undefined ||
        st.isFetchingMore ||
        !channel
      ) {
        return;
      }
      const s = session;
      store.set({ isFetchingMore: true });
      channel.page(cursor, pageSize).then(
        (page) => {
          if (s !== session) return;
          try {
            mergePage(page);
          } catch (error) {
            fail(decodeError(error));
            return;
          }
          store.set({ isFetchingMore: false, error: undefined });
          publish();
        },
        (error: unknown) => {
          if (s !== session) return;
          store.set({ isFetchingMore: false });
          if (!isClientError(error, "NETWORK")) fail(decodeError(error));
        },
      );
    },
    reload: () => {
      if (closed) return;
      session++;
      channel?.close();
      channel = undefined;
      known = new Map();
      loadedCount = 0;
      cursor = undefined;
      boundary = undefined;
      pausedOrigins.clear();
      store.set({
        status: "loading",
        items: [],
        hasMore: false,
        isFetchingMore: false,
        error: undefined,
      });
      start();
    },
    close: () => {
      closed = true;
      session++;
      if (sweeper) clearInterval(sweeper);
      channel?.close();
      channel = undefined;
      store.close();
    },
  };
};
