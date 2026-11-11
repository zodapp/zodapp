/**
 * 書き込み → MQTT → Realtime Gateway → Client の store まで往復する（S8）。
 * DynamoDB Local と、プロセス内の MQTT ブローカー（aedes）を使う。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "./api";
import { isClientError } from "./errors";
import type { ListState, ListStore } from "./store";
import { endpoints, startApp, type TestApp } from "./test/app";
import { startBroker } from "./test/broker";
import { waitFor } from "./test/wait";

let broker: Awaited<ReturnType<typeof startBroker>>;
let app: TestApp;
const as = (user: string) =>
  createClient(endpoints, {
    baseUrl: app.baseUrl,
    headers: () => ({ "x-user": user }),
    realtime: {
      url: `${app.realtimeUrl}?user=${user}`,
    },
  });

beforeAll(async () => {
  broker = await startBroker();
  app = await startApp({ mqttUrl: broker.url });
});
afterAll(async () => {
  await app?.close();
  await broker?.close();
});

let seq = 0;
const newKey = (workspaceId: string) => ({
  workspaceId,
  taskId: `t${String(++seq).padStart(3, "0")}`,
});
const newTask = (extra: Record<string, unknown> = {}) => ({
  title: "a",
  status: "todo" as const,
  priority: 3,
  assignee: "u1",
  ...extra,
});

const until = <T>(store: ListStore<T>, done: (s: ListState<T>) => boolean) =>
  waitFor<ListState<T>>(store, done, 5000);

describe("リアルタイムの一覧（往復）", () => {
  it("全体の購読：ページと変更で一覧を保つ", async () => {
    const client = as("u1");
    const workspaceId = "ws1";
    const first = newKey(workspaceId);
    await client.tasks.create(first, newTask());

    const store = client.tasks.all.live({ workspaceId });
    let s = await until(store, (x) => x.status === "ready");
    expect(s.items.map((t) => t.taskId)).toEqual([first.taskId]);

    const second = newKey(workspaceId);
    await client.tasks.create(second, newTask({ title: "b" }));
    s = await until(store, (x) => x.items.length === 2);
    expect(s.items[1]).toMatchObject({ taskId: second.taskId, title: "b" });
    expect(s.items[1]!.createdAt).toBeInstanceOf(Date);

    await client.tasks.setStatus(second, { status: "done" });
    s = await until(store, (x) => x.items[1]?.status === "done");

    await client.tasks.remove(first);
    s = await until(store, (x) => x.items.length === 1);
    expect(s.items[0]!.taskId).toBe(second.taskId);
    store.close();
  });

  it("範囲の条件と progressive：priority の降順、fields で絞る、fetchMore で遡る", async () => {
    const client = as("u1");
    const workspaceId = "ws2";
    for (const priority of [9, 7, 5, 3]) {
      await client.tasks.create(newKey(workspaceId), newTask({ priority }));
    }
    const store = client.tasks.byStatus.live(
      { workspaceId, status: "todo", minPriority: 4 },
      { pageSize: 2 },
    );
    let s = await until(store, (x) => x.status === "ready");
    expect(s.items.map((t) => t.priority)).toEqual([9, 7]);
    expect(Object.keys(s.items[0]!).sort()).toEqual([
      "priority",
      "status",
      "taskId",
      "title",
      "workspaceId",
    ]);
    expect(s.hasMore).toBe(true);

    // ウィンドウの中に入る変更と、範囲の外の変更
    const k8 = newKey(workspaceId);
    await client.tasks.create(k8, newTask({ priority: 8 }));
    await client.tasks.create(newKey(workspaceId), newTask({ priority: 1 }));
    s = await until(store, (x) => x.items.length === 3);
    expect(s.items.map((t) => t.priority)).toEqual([9, 8, 7]);

    store.fetchMore();
    s = await until(store, (x) => !x.isFetchingMore && x.items.length === 4);
    expect(s.items.map((t) => t.priority)).toEqual([9, 8, 7, 5]);

    // 範囲から出る
    await client.tasks.setStatus(k8, { status: "doing" });
    s = await until(store, (x) => x.items.length === 3);
    expect(s.items.map((t) => t.priority)).toEqual([9, 7, 5]);
    store.close();
  });

  it("認証コンテキストを使う購読と、FORBIDDEN", async () => {
    const carol = as("carol");
    const store = carol.tasks.mine.live({ workspaceId: "ws3" });
    await until(store, (x) => x.status === "ready");
    const key = newKey("ws3");
    await carol.tasks.create(key, newTask({ assignee: "carol" }));
    await carol.tasks.create(newKey("ws3"), newTask({ assignee: "dave" }));
    const s = await until(store, (x) => x.items.length === 1);
    expect(s.items[0]!.taskId).toBe(key.taskId);
    store.close();

    const denied = carol.tasks.all.live({ workspaceId: "other" });
    const d = await until(denied, (x) => x.status === "error");
    expect(isClientError(d.error, "FORBIDDEN")).toBe(true);
  });
});
