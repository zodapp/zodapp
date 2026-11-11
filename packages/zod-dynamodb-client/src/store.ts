import { ClientError } from "./errors";

/**
 * 一覧の状態（K4）。1回きりの取得（`onceListStore`）とリアルタイム（`api.tasks.byStatus.live`）で同じ形。
 */
export type ListState<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
  /** まだ読んでいない古いページがあるか（progressive） */
  hasMore: boolean;
  /** `fetchMore` の途中か */
  isFetchingMore: boolean;
  /** 最後に起きたエラー。`status` が `"ready"` のままのこともある（`fetchMore` の失敗など） */
  error?: Error;
};

export type ListStore<T> = {
  getState(): ListState<T>;
  /** 状態が変わるたびに呼ばれる。戻り値で登録を解除する */
  subscribe(listener: () => void): () => void;
  /** 次のページを読む（progressive）。読むものがなければ何もしない */
  fetchMore(): void;
  /** 最初から読み直す */
  reload(): void;
  /** 終える。以降は状態が変わらない */
  close(): void;
};

export type ListOptions = {
  /**
   * progressive にする。最初にこの件数を読み、`fetchMore` で同じ件数ずつ遡る。
   * 省略すると最後のページまで読む（全体）
   */
  pageSize?: number;
  /** 全体を読むときの件数の上限。超えたら `TOO_MANY_ITEMS` のエラー。既定は 10,000 */
  maxSnapshotItems?: number;
};

export type ItemState<T> = {
  status: "loading" | "ready" | "error";
  item: T | null;
  /** `withToken` のGetエンドポイントでは、`ifUnchanged` に渡すトークン */
  token?: string;
  error?: Error;
};

export type ItemStore<T> = {
  getState(): ItemState<T>;
  subscribe(listener: () => void): () => void;
  reload(): void;
  close(): void;
};

export const DEFAULT_MAX_SNAPSHOT_ITEMS = 10_000;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/** 状態と購読者を持つ小さな入れ物 */
export const createState = <S>(initial: S) => {
  let state = initial;
  const listeners = new Set<() => void>();
  let closed = false;
  return {
    get: () => state,
    set: (patch: Partial<S>) => {
      if (closed) return;
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: () => {
      closed = true;
      listeners.clear();
    },
    get closed() {
      return closed;
    },
  };
};

type Page<T> = { items: T[]; cursor?: string };

/**
 * 1回きりの取得の一覧（K4）。ページを読む関数から作る。
 * `pageSize` を指定すると progressive、省略すると最後のページまで読む。
 */
export const createOnceListStore = <T>(
  loadPage: (
    cursor: string | undefined,
    limit: number | undefined,
  ) => Promise<Page<T>>,
  options: ListOptions = {},
): ListStore<T> => {
  const max = options.maxSnapshotItems ?? DEFAULT_MAX_SNAPSHOT_ITEMS;
  const store = createState<ListState<T>>({
    status: "loading",
    items: [],
    hasMore: false,
    isFetchingMore: false,
  });
  let generation = 0;
  let cursor: string | undefined;

  const load = async () => {
    const gen = ++generation;
    cursor = undefined;
    store.set({
      status: "loading",
      items: [],
      hasMore: false,
      isFetchingMore: false,
      error: undefined,
    });
    try {
      if (options.pageSize !== undefined) {
        const page = await loadPage(undefined, options.pageSize);
        if (gen !== generation) return;
        cursor = page.cursor;
        store.set({ status: "ready", items: page.items, hasMore: !!cursor });
        return;
      }
      const items: T[] = [];
      let next: string | undefined;
      do {
        const page = await loadPage(next, undefined);
        if (gen !== generation) return;
        items.push(...page.items);
        if (items.length > max) throw new ClientError("TOO_MANY_ITEMS");
        next = page.cursor;
      } while (next);
      store.set({ status: "ready", items, hasMore: false });
    } catch (error) {
      if (gen !== generation) return;
      store.set({ status: "error", error: toError(error) });
    }
  };

  const fetchMore = () => {
    const s = store.get();
    if (s.status !== "ready" || !s.hasMore || s.isFetchingMore) return;
    const gen = generation;
    store.set({ isFetchingMore: true });
    loadPage(cursor, options.pageSize).then(
      (page) => {
        if (gen !== generation) return;
        cursor = page.cursor;
        store.set({
          items: [...store.get().items, ...page.items],
          hasMore: !!cursor,
          isFetchingMore: false,
          error: undefined,
        });
      },
      (error) => {
        if (gen !== generation) return;
        store.set({ isFetchingMore: false, error: toError(error) });
      },
    );
  };

  void load();
  return {
    getState: store.get,
    subscribe: store.subscribe,
    fetchMore,
    reload: () => void load(),
    close: () => {
      generation++;
      store.close();
    },
  };
};

/** 1回きりのItemの取得（K4） */
export const createOnceItemStore = <T>(
  loadItem: () => Promise<{ item: T | null; token?: string }>,
): ItemStore<T> => {
  const store = createState<ItemState<T>>({ status: "loading", item: null });
  let generation = 0;
  const load = async () => {
    const gen = ++generation;
    store.set({ status: "loading", error: undefined });
    try {
      const out = await loadItem();
      if (gen !== generation) return;
      store.set({ status: "ready", item: out.item, token: out.token });
    } catch (error) {
      if (gen !== generation) return;
      store.set({ status: "error", error: toError(error) });
    }
  };
  void load();
  return {
    getState: store.get,
    subscribe: store.subscribe,
    reload: () => void load(),
    close: () => {
      generation++;
      store.close();
    },
  };
};
