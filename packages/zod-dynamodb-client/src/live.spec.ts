import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./api";
import { isClientError } from "./errors";
import { OUT_OF_WINDOW_RETENTION_MS } from "./live";
import type { ListStore } from "./store";
import { endpoints } from "./test/app";
import { FakeWebSocket, flush } from "./test/fake-ws";

const now = "2026-11-05T00:00:00.000Z";
const task = (taskId: string, extra: Record<string, unknown> = {}) => ({
  workspaceId: "ws1",
  taskId,
  title: taskId,
  status: "todo",
  priority: 3,
  assignee: "u1",
  createdAt: now,
  updatedAt: now,
  ...extra,
});
const key = (taskId: string) => ({ workspaceId: "ws1", taskId });
const origin = { kind: "single", id: "o" };

const makeClient = () =>
  createClient(endpoints, {
    baseUrl: "",
    realtime: {
      url: "ws://test/realtime",
      WebSocket: FakeWebSocket,
      reconnectDelay: 1,
      idleTimeout: 5,
    },
  });

const ids = (store: ListStore<{ taskId: string }>) =>
  store.getState().items.map((t) => t.taskId);

/** 購読を始めて ready を返し、送られた subscribe の id を返す */
const ready = async (ws: FakeWebSocket) => {
  await flush();
  if (ws.readyState === 0) ws.open();
  const sub = ws.lastSent("subscribe");
  ws.receive({ type: "ready", id: sub.id });
  await flush();
  return sub.id as number;
};

const page = async (
  ws: FakeWebSocket,
  id: number,
  items: [ReturnType<typeof task>, number][],
  cursor?: string,
) => {
  ws.receive({
    type: "page",
    id,
    items: items.map(([item, version]) => ({ item, version })),
    ...(cursor ? { cursor } : {}),
  });
  await flush();
};

beforeEach(() => {
  FakeWebSocket.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("live の一覧（全体）", () => {
  it("ready の後にページを最後まで読み、届いていた変更と version で突き合わせる", async () => {
    const client = makeClient();
    const store = client.tasks.all.live({ workspaceId: "ws1" });
    expect(store.getState().status).toBe("loading");
    const ws = FakeWebSocket.last;
    const id = await ready(ws);
    expect(ws.lastSent("subscribe")).toMatchObject({
      name: "tasks.all",
      params: { workspaceId: "ws1" },
    });
    // ページを読む前に届いた変更：b は新しい版、c は削除
    ws.receive({
      type: "change",
      id,
      change: "MODIFIED",
      key: key("b"),
      item: task("b", { title: "b2" }),
      version: 5,
      origin,
    });
    ws.receive({
      type: "change",
      id,
      change: "REMOVED",
      key: key("c"),
      version: 3,
      origin,
    });
    expect(ws.lastSent("page")).toMatchObject({ id, limit: 10_001 });
    await page(
      ws,
      id,
      [
        [task("a"), 1],
        [task("b"), 4],
      ],
      "next",
    );
    expect(store.getState().status).toBe("loading");
    expect(ws.lastSent("page")).toMatchObject({ cursor: "next" });
    await page(ws, id, [
      [task("c"), 2],
      [task("d"), 1],
    ]);
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.hasMore).toBe(false);
    expect(ids(store)).toEqual(["a", "b", "d"]);
    expect(s.items[1]!.title).toBe("b2");
    expect(s.items[0]!.createdAt).toBeInstanceOf(Date);

    // 以降の変更。古い版は無視する
    ws.receive({
      type: "change",
      id,
      change: "ADDED",
      key: key("aa"),
      item: task("aa"),
      version: 1,
      origin,
    });
    ws.receive({
      type: "change",
      id,
      change: "MODIFIED",
      key: key("b"),
      item: task("b", { title: "old" }),
      version: 4,
      origin,
    });
    expect(ids(store)).toEqual(["a", "aa", "b", "d"]);
    expect(store.getState().items[2]!.title).toBe("b2");
    ws.receive({
      type: "change",
      id,
      change: "REMOVED",
      key: key("a"),
      version: 2,
      origin,
    });
    expect(ids(store)).toEqual(["aa", "b", "d"]);
    store.close();
  });

  it("並び順は名前付きクエリの Sort Key と方向（priority の降順）", async () => {
    const client = makeClient();
    const store = client.tasks.byStatus.live({
      workspaceId: "ws1",
      status: "todo",
    });
    const ws = FakeWebSocket.last;
    const id = await ready(ws);
    const p = (taskId: string, priority: number) => ({
      workspaceId: "ws1",
      taskId,
      title: taskId,
      status: "todo",
      priority,
    });
    ws.receive({
      type: "page",
      id,
      items: [
        { item: p("x", 5), version: 1 },
        { item: p("y", 2), version: 1 },
      ],
    });
    await flush();
    ws.receive({
      type: "change",
      id,
      change: "ADDED",
      key: key("z"),
      item: p("z", 3),
      version: 1,
      origin,
    });
    expect(ids(store)).toEqual(["x", "z", "y"]);
    store.close();
  });

  it("件数の上限を超えたら TOO_MANY_ITEMS", async () => {
    const client = makeClient();
    const store = client.tasks.all.live(
      { workspaceId: "ws1" },
      { maxSnapshotItems: 2 },
    );
    const ws = FakeWebSocket.last;
    const id = await ready(ws);
    expect(ws.lastSent("page").limit).toBe(3);
    await page(ws, id, [
      [task("a"), 1],
      [task("b"), 1],
      [task("c"), 1],
    ]);
    expect(store.getState().status).toBe("error");
    expect(isClientError(store.getState().error, "TOO_MANY_ITEMS")).toBe(true);
    expect(ws.lastSent("unsubscribe")).toMatchObject({ id });
  });

  it("購読のエラー（FORBIDDEN）と、パラメーターの誤り", async () => {
    const client = makeClient();
    const store = client.tasks.all.live({ workspaceId: "ws1" });
    const ws = FakeWebSocket.last;
    await flush();
    ws.open();
    const { id } = ws.lastSent("subscribe");
    ws.receive({ type: "error", id, code: "FORBIDDEN", message: "no" });
    expect(isClientError(store.getState().error, "FORBIDDEN")).toBe(true);
    const bad = client.tasks.all.live({ workspaceId: 1 } as never);
    expect(isClientError(bad.getState().error, "INVALID_INPUT")).toBe(true);
  });
});

describe("認証の情報の入れ替え", () => {
  it("realtime.authenticate は、つながっていれば auth メッセージを送り、つながっていなければ何もしない", async () => {
    const client = makeClient();
    client.realtime.authenticate({ token: "early" }); // まだ接続がない
    const store = client.tasks.all.live({ workspaceId: "ws1" });
    const ws = FakeWebSocket.last;
    client.realtime.authenticate({ token: "before-open" });
    await ready(ws);
    client.realtime.authenticate({ token: "t2" });
    expect(ws.sent.filter((m) => m.type === "auth")).toEqual([
      { type: "auth", payload: { token: "t2" } },
    ]);
    expect(store.getState().status).not.toBe("error");
  });

  it("UNAUTHENTICATED で接続が閉じられたら、つながり直して購読し直す", async () => {
    const client = makeClient();
    const store = client.tasks.all.live({ workspaceId: "ws1" });
    const first = FakeWebSocket.last;
    await ready(first);
    first.receive({
      type: "error",
      code: "UNAUTHENTICATED",
      message: "expired",
    });
    first.drop();
    await new Promise((r) => setTimeout(r, 20));
    const second = FakeWebSocket.last;
    expect(second).not.toBe(first);
    second.open();
    expect(second.lastSent("subscribe")).toMatchObject({ name: "tasks.all" });
    expect(store.getState().status).not.toBe("error");
  });
});

describe("live の一覧（progressive）", () => {
  it("ウィンドウの中だけを出し、fetchMore で遡る。ウィンドウの外の変更は 60 秒だけ覚える", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    const client = makeClient();
    const store = client.tasks.all.live(
      { workspaceId: "ws1" },
      { pageSize: 2 },
    );
    const ws = FakeWebSocket.last;
    const id = await ready(ws);
    expect(ws.lastSent("page")).toMatchObject({ limit: 2 });
    await page(
      ws,
      id,
      [
        [task("a"), 1],
        [task("b"), 1],
      ],
      "c1",
    );
    expect(ids(store)).toEqual(["a", "b"]);
    expect(store.getState().hasMore).toBe(true);

    // ウィンドウの外（b より後）の変更は出さない。中の変更は出す
    ws.receive({
      type: "change",
      id,
      change: "MODIFIED",
      key: key("c"),
      item: task("c", { title: "c2" }),
      version: 2,
      origin,
    });
    ws.receive({
      type: "change",
      id,
      change: "ADDED",
      key: key("ab"),
      item: task("ab"),
      version: 1,
      origin,
    });
    expect(ids(store)).toEqual(["a", "ab", "b"]);

    // 遡ったページが古くても（GSI の結果整合性）、覚えていた変更で直す
    store.fetchMore();
    expect(store.getState().isFetchingMore).toBe(true);
    expect(ws.lastSent("page")).toMatchObject({ cursor: "c1", limit: 2 });
    await page(
      ws,
      id,
      [
        [task("c"), 1],
        [task("d"), 1],
      ],
      "c2",
    );
    expect(ids(store)).toEqual(["a", "ab", "b", "c", "d"]);
    expect(store.getState().items[3]!.title).toBe("c2");

    // 60 秒を過ぎたウィンドウの外の変更は捨てる
    ws.receive({
      type: "change",
      id,
      change: "MODIFIED",
      key: key("e"),
      item: task("e", { title: "e2" }),
      version: 2,
      origin,
    });
    vi.setSystemTime(
      new Date(Date.parse(now) + OUT_OF_WINDOW_RETENTION_MS + 1),
    );
    ws.receive({
      type: "change",
      id,
      change: "ADDED",
      key: key("b2"),
      item: task("b2"),
      version: 1,
      origin,
    });
    store.fetchMore();
    await page(ws, id, [[task("e"), 1]]);
    expect(store.getState().items.at(-1)!.title).toBe("e");
    expect(store.getState().hasMore).toBe(false);
    store.close();
  });

  it("再接続したら、読んでいた件数まで読み直す。Tombstone は残し、それまでは前の一覧を出す", async () => {
    const client = makeClient();
    const store = client.tasks.all.live(
      { workspaceId: "ws1" },
      { pageSize: 2 },
    );
    let ws = FakeWebSocket.last;
    let id = await ready(ws);
    await page(
      ws,
      id,
      [
        [task("a"), 1],
        [task("b"), 1],
      ],
      "c1",
    );
    store.fetchMore();
    await page(
      ws,
      id,
      [
        [task("c"), 1],
        [task("d"), 1],
      ],
      "c2",
    );
    ws.receive({
      type: "change",
      id,
      change: "REMOVED",
      key: key("b"),
      version: 2,
      origin,
    });
    expect(ids(store)).toEqual(["a", "c", "d"]);

    ws.drop();
    expect(store.getState().status).toBe("ready");
    expect(ids(store)).toEqual(["a", "c", "d"]);
    await new Promise((r) => setTimeout(r, 20));
    ws = FakeWebSocket.last;
    expect(FakeWebSocket.instances).toHaveLength(2);
    id = await ready(ws);
    // 古いページ（b がまだ残っている）でも、Tombstone で消したまま。切れている間に消えた c は出さない
    await page(
      ws,
      id,
      [
        [task("a"), 1],
        [task("b"), 1],
      ],
      "r1",
    );
    expect(ids(store)).toEqual(["a", "c", "d"]); // 読み直しの途中は前の一覧
    expect(ws.lastSent("page")).toMatchObject({ cursor: "r1" });
    await page(
      ws,
      id,
      [
        [task("d"), 1],
        [task("e"), 1],
      ],
      "r2",
    );
    expect(ids(store)).toEqual(["a", "d", "e"]);
    expect(store.getState().hasMore).toBe(true);
    store.close();
  });

  it("onBatch: reload は、一括での書き込みの変更を適用せず、終了で読み直す", async () => {
    const client = makeClient();
    const store = client.tasks.all.live(
      { workspaceId: "ws1" },
      { onBatch: "reload" },
    );
    const ws = FakeWebSocket.last;
    const id = await ready(ws);
    await page(ws, id, [[task("a"), 1]]);
    const batch = { kind: "batch", id: "b1" };
    ws.receive({
      type: "batch",
      id,
      marker: { type: "BATCH_STARTED", origin: batch },
    });
    ws.receive({
      type: "change",
      id,
      change: "ADDED",
      key: key("x"),
      item: task("x"),
      version: 1,
      origin: batch,
    });
    expect(ids(store)).toEqual(["a"]);
    ws.receive({
      type: "batch",
      id,
      marker: {
        type: "BATCH_FINISHED",
        origin: batch,
        count: 2,
        status: "completed",
      },
    });
    await flush();
    await page(ws, id, [
      [task("a"), 1],
      [task("x"), 1],
      [task("y"), 1],
    ]);
    expect(ids(store)).toEqual(["a", "x", "y"]);
    store.close();
  });
});

describe("接続", () => {
  it("購読は 1 本の接続を共有し、すべて閉じたら接続を閉じる", async () => {
    const client = makeClient();
    const a = client.tasks.all.live({ workspaceId: "ws1" });
    const b = client.tasks.all.live({ workspaceId: "ws2" });
    await flush();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.last;
    ws.open();
    expect(ws.sent.filter((m) => m.type === "subscribe")).toHaveLength(2);
    a.close();
    b.close();
    expect(ws.sent.filter((m) => m.type === "unsubscribe")).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 20));
    expect(ws.closed).toBe(true);
  });
});
