import { describe, expect, it } from "vitest";
import { isClientError } from "./errors";
import { createOnceListStore, type ListState, type ListStore } from "./store";
import { waitFor } from "./test/wait";

const pages = (data: number[], size: number) => {
  const calls: { cursor?: string; limit?: number }[] = [];
  const load = async (
    cursor: string | undefined,
    limit: number | undefined,
  ) => {
    calls.push({ cursor, limit });
    const start = cursor ? Number(cursor) : 0;
    const n = limit ?? size;
    const items = data.slice(start, start + n);
    const next = start + n < data.length ? String(start + n) : undefined;
    return { items, cursor: next };
  };
  return { load, calls };
};

const ready = <T>(store: ListStore<T>) =>
  waitFor<ListState<T>>(
    store,
    (s) => s.status !== "loading" && !s.isFetchingMore,
  );

describe("1回きりの一覧の store", () => {
  it("pageSize がなければ最後のページまで読む", async () => {
    const { load, calls } = pages([1, 2, 3, 4, 5], 2);
    const store = createOnceListStore(load);
    const s = await ready(store);
    expect(s).toMatchObject({
      status: "ready",
      items: [1, 2, 3, 4, 5],
      hasMore: false,
    });
    expect(calls.map((c) => c.cursor)).toEqual([undefined, "2", "4"]);
  });

  it("件数の上限を超えたら TOO_MANY_ITEMS", async () => {
    const { load } = pages([1, 2, 3, 4, 5], 2);
    const store = createOnceListStore(load, { maxSnapshotItems: 3 });
    const s = await ready(store);
    expect(s.status).toBe("error");
    expect(isClientError(s.error, "TOO_MANY_ITEMS")).toBe(true);
  });

  it("progressive：pageSize ずつ fetchMore で遡る", async () => {
    const { load, calls } = pages([1, 2, 3, 4, 5], 2);
    const store = createOnceListStore(load, { pageSize: 2 });
    expect((await ready(store)).items).toEqual([1, 2]);
    expect(store.getState().hasMore).toBe(true);
    store.fetchMore();
    expect(store.getState().isFetchingMore).toBe(true);
    store.fetchMore(); // 途中の重複は無視する
    expect((await ready(store)).items).toEqual([1, 2, 3, 4]);
    store.fetchMore();
    const last = await ready(store);
    expect(last.items).toEqual([1, 2, 3, 4, 5]);
    expect(last.hasMore).toBe(false);
    store.fetchMore();
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.limit === 2)).toBe(true);
  });

  it("fetchMore の失敗は、読んだ分を残して error を付ける", async () => {
    let fail = false;
    const store = createOnceListStore(
      async (cursor) => {
        if (fail) throw new Error("boom");
        return { items: [cursor ?? "first"], cursor: "next" };
      },
      { pageSize: 1 },
    );
    await ready(store);
    fail = true;
    store.fetchMore();
    const s = await ready(store);
    expect(s).toMatchObject({ status: "ready", items: ["first"] });
    expect(s.error?.message).toBe("boom");
  });

  it("reload で読み直し、close の後は変わらない", async () => {
    let round = 0;
    const store = createOnceListStore(async () => ({
      items: [++round],
    }));
    expect((await ready(store)).items).toEqual([1]);
    store.reload();
    expect((await ready(store)).items).toEqual([2]);
    store.close();
    store.reload();
    await new Promise((r) => setTimeout(r, 10));
    expect(store.getState().items).toEqual([2]);
  });
});
