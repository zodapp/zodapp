import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { connect, startApp } from "./test/app";

let app: Awaited<ReturnType<typeof startApp>>;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

let seq = 0;
const ws = () => `w${++seq}`;
const task = (extra: Record<string, unknown> = {}) => ({
  title: "a",
  status: "todo" as const,
  priority: 3,
  assignee: "u1",
  ...extra,
});

describe("Realtime Gateway", () => {
  it("認証に失敗したら upgrade を 401 で拒否する", async () => {
    const socket = new WebSocket(app.url);
    const status = await new Promise<number | undefined>((resolve) => {
      socket.on("unexpected-response", (_req, res) => resolve(res.statusCode));
      socket.on("open", () => resolve(undefined));
    });
    expect(status).toBe(401);
  });

  it("購読 → ready → ページ（version 付き、fields で絞る、maxPageSize まで）", async () => {
    const w = ws();
    const t = app.repository.forTable((await import("./test/app")).tasks);
    for (let i = 0; i < 4; i++) {
      await t.create(
        { workspaceId: w, taskId: `t${i}` },
        task({ priority: i }),
      );
    }
    const c = await connect(app.url);
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.byStatus",
      params: { workspaceId: w, status: "todo", minPriority: 1 },
    });
    await c.next((m) => m.type === "ready" && m.id === 1);
    c.send({ type: "page", id: 1, limit: 100 });
    const first = await c.next((m) => m.type === "page");
    // maxPageSize は 3。priority の降順
    expect(first.items.map((i: any) => i.item.taskId)).toEqual([
      "t3",
      "t2",
      "t1",
    ]);
    expect(first.items[0]).toEqual({
      item: {
        workspaceId: w,
        taskId: "t3",
        title: "a",
        status: "todo",
        priority: 3,
      },
      version: 1,
    });
    expect(typeof first.cursor).toBe("string");
    c.send({ type: "page", id: 1, limit: 100, cursor: first.cursor });
    const second = await c.next((m) => m.type === "page");
    expect(second.items).toEqual([]);
    expect(second.cursor).toBeUndefined();
    c.close();
  });

  it("範囲の出入り：ADDED・MODIFIED・REMOVED。範囲の外の変更は送らない", async () => {
    const w = ws();
    const { tasks } = await import("./test/app");
    const t = app.repository.forTable(tasks);
    const c = await connect(app.url);
    c.send({
      type: "subscribe",
      id: 7,
      name: "tasks.byStatus",
      params: { workspaceId: w, status: "todo", minPriority: 3 },
    });
    await c.next((m) => m.type === "ready");
    const key = { workspaceId: w, taskId: "x" };
    await t.create(key, task({ priority: 1 })); // 範囲の外
    await t.update(key, { priority: 5 }); // 入る
    await t.update(key, { title: "b" }); // 中で変わる
    await t.update(key, { status: "done" }); // 出る
    const changes = [
      await c.next((m) => m.type === "change"),
      await c.next((m) => m.type === "change"),
      await c.next((m) => m.type === "change"),
    ];
    expect(changes.map((m) => [m.change, m.version])).toEqual([
      ["ADDED", 2],
      ["MODIFIED", 3],
      ["REMOVED", 4],
    ]);
    expect(changes[1]!.item).toEqual({
      workspaceId: w,
      taskId: "x",
      title: "b",
      status: "todo",
      priority: 5,
    });
    expect(changes[2]!.item).toBeUndefined();
    expect(changes[2]!.key).toEqual(key);
    expect(changes[0]!.origin.kind).toBe("single");
    await new Promise((r) => setTimeout(r, 50));
    expect(c.received.filter((m) => m.type === "change")).toHaveLength(3);
    c.close();
  });

  it("同じ Index の別の購読と、認証コンテキストを使う購読。Date を transport で運ぶ", async () => {
    const w = ws();
    const { tasks } = await import("./test/app");
    const t = app.repository.forTable(tasks);
    const alice = await connect(app.url, "alice");
    const bob = await connect(app.url, "bob");
    for (const c of [alice, bob]) {
      c.send({
        type: "subscribe",
        id: 1,
        name: "tasks.mine",
        params: { workspaceId: w },
      });
      c.send({
        type: "subscribe",
        id: 2,
        name: "tasks.all",
        params: { workspaceId: w },
      });
      await c.next((m) => m.type === "ready" && m.id === 1);
      await c.next((m) => m.type === "ready" && m.id === 2);
    }
    const dueAt = new Date("2026-03-01T00:00:00.000Z");
    await t.create(
      { workspaceId: w, taskId: "a" },
      task({ assignee: "alice", dueAt }),
    );
    const mine = await alice.next((m) => m.type === "change" && m.id === 1);
    expect(mine.item.dueAt).toBe(dueAt.toISOString());
    await alice.next((m) => m.type === "change" && m.id === 2);
    await bob.next((m) => m.type === "change" && m.id === 2);
    await new Promise((r) => setTimeout(r, 50));
    expect(bob.received.some((m) => m.type === "change" && m.id === 1)).toBe(
      false,
    );
    alice.close();
    bob.close();
  });

  it("FORBIDDEN、不明な名前、パラメーターの誤り、ready 前のページ", async () => {
    const c = await connect(app.url);
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.byStatus",
      params: { workspaceId: "secret", status: "todo" },
    });
    expect(await c.next((m) => m.type === "error" && m.id === 1)).toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
    c.send({ type: "subscribe", id: 2, name: "nope", params: {} });
    expect(await c.next((m) => m.id === 2)).toMatchObject({
      code: "INVALID_INPUT",
    });
    c.send({
      type: "subscribe",
      id: 3,
      name: "tasks.all",
      params: { workspaceId: 1 },
    });
    expect(await c.next((m) => m.id === 3)).toMatchObject({
      code: "INVALID_INPUT",
    });
    c.send({ type: "page", id: 4, limit: 1 });
    expect(await c.next((m) => m.id === 4)).toMatchObject({
      code: "INVALID_INPUT",
    });
    c.ws.send("not json");
    expect(
      await c.next((m) => m.type === "error" && m.id === undefined),
    ).toMatchObject({
      code: "INVALID_INPUT",
    });
    c.send({
      type: "subscribe",
      id: 5,
      name: "tasks.all",
      params: { workspaceId: "w" },
    });
    await c.next((m) => m.type === "ready" && m.id === 5);
    c.send({ type: "page", id: 5, limit: 1, cursor: "broken" });
    expect(await c.next((m) => m.id === 5 && m.type === "error")).toMatchObject(
      {
        code: "INVALID_CURSOR",
      },
    );
    c.close();
  });

  it("一括での書き込みの開始・終了と、個々の変更", async () => {
    const w = ws();
    const { tasks } = await import("./test/app");
    const t = app.repository.forTable(tasks);
    const c = await connect(app.url);
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.all",
      params: { workspaceId: w },
    });
    await c.next((m) => m.type === "ready");
    await t.bulkWrite({
      scope: { workspaceId: w },
      items: [
        { key: { workspaceId: w, taskId: "b1" }, input: task() },
        { key: { workspaceId: w, taskId: "b2" }, input: task() },
      ],
    });
    const started = await c.next((m) => m.type === "batch");
    expect(started.marker).toMatchObject({
      type: "BATCH_STARTED",
      origin: { kind: "batch" },
    });
    const finished = await c.next((m) => m.type === "batch");
    expect(finished.marker).toMatchObject({
      type: "BATCH_FINISHED",
      count: 2,
      status: "completed",
    });
    const changes = c.received.filter((m) => m.type === "change");
    expect(changes.map((m) => m.change)).toEqual(["ADDED", "ADDED"]);
    expect(changes[0]!.origin.id).toBe(started.marker.origin.id);
    c.close();
  });

  it("解除と切断でトピックの参照を減らす", async () => {
    const w = ws();
    const { tasks } = await import("./test/app");
    const t = app.repository.forTable(tasks);
    const a = await connect(app.url);
    const b = await connect(app.url);
    for (const c of [a, b]) {
      c.send({
        type: "subscribe",
        id: 1,
        name: "tasks.all",
        params: { workspaceId: w },
      });
      await c.next((m) => m.type === "ready");
    }
    a.send({ type: "unsubscribe", id: 1 });
    b.close();
    await new Promise((r) => setTimeout(r, 50));
    await t.create({ workspaceId: w, taskId: "z" }, task());
    await new Promise((r) => setTimeout(r, 50));
    expect(a.received.filter((m) => m.type === "change")).toHaveLength(0);
    a.close();
  });
});
