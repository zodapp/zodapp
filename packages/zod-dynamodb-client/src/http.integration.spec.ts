import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type ClientInstance } from "./api";
import { isClientError } from "./errors";
import { onceItemStore, onceListStore } from "./sources";
import { waitFor } from "./test/wait";
import {
  endpoints,
  override,
  resolveAuth,
  startApp,
  taskOps,
  type TestApp,
} from "./test/app";

let app: TestApp;
let api: ClientInstance<typeof endpoints>;
const as = (user: string) =>
  createClient(endpoints, {
    baseUrl: app.baseUrl,
    headers: () => ({ "x-user": user }),
  });

beforeAll(async () => {
  app = await startApp();
  api = as("u1");
});
afterAll(async () => {
  await app?.close();
});

let seq = 0;
const newKey = (workspaceId = "ws1") => ({
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

describe("Client と Express と DynamoDB Local", () => {
  it("作成・取得・削除。Date・bigint・Set を往復する", async () => {
    const key = newKey();
    const created = await api.tasks.create(
      key,
      newTask({ estimate: 10n ** 20n, tags: new Set(["x"]) }),
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    const got = await api.tasks.get(key, { withToken: true });
    expect(got.item?.estimate).toBe(10n ** 20n);
    expect(got.item?.tags).toEqual(new Set(["x"]));
    expect(typeof got.token).toBe("string");
    await api.tasks.remove(key);
    expect(await api.tasks.get(key)).toBeNull();
  });

  it("GET：パスのパラメーターとクエリ文字列の input", async () => {
    const workspaceId = "ws2";
    for (const priority of [1, 5, 7]) {
      await api.tasks.create(newKey(workspaceId), newTask({ priority }));
    }
    const one = await api.tasks.getByPath({
      workspaceId,
      taskId: `t${String(seq).padStart(3, "0")}`,
    });
    expect(one?.priority).toBe(7);
    const res = await api.tasks.byStatusGet({
      workspaceId,
      status: "todo",
      minPriority: 4,
    });
    expect(res.items.map((t) => t.priority)).toEqual([7, 5]);
  });

  it("ifUnchanged と CONFLICT、where と NOT_FOUND、FORBIDDEN", async () => {
    const key = newKey();
    await api.tasks.create(key, newTask());
    const { token } = await api.tasks.get(key, { withToken: true });
    await api.tasks.setStatus(key, { status: "doing" }, { ifUnchanged: token });
    const stale = await api.tasks
      .setStatus(key, { status: "done" }, { ifUnchanged: token })
      .catch((e: unknown) => e);
    expect(isClientError(stale, "CONFLICT")).toBe(true);

    const notMine = await as("u2")
      .tasks.setStatus(key, { status: "done" })
      .catch((e: unknown) => e);
    expect(isClientError(notMine, "NOT_FOUND")).toBe(true);

    const forbidden = await api.tasks
      .get({ workspaceId: "other", taskId: "x" })
      .catch((e: unknown) => e);
    expect(isClientError(forbidden, "FORBIDDEN")).toBe(true);
    expect((forbidden as { status: number }).status).toBe(403);
  });

  it("pages() と、1 回きりの store（全体と progressive）", async () => {
    const workspaceId = "ws3";
    for (let i = 0; i < 5; i++) {
      await api.tasks.create(newKey(workspaceId), newTask());
    }
    const viaPages: string[] = [];
    for await (const page of api.tasks.all.pages(
      { workspaceId },
      { limit: 2 },
    )) {
      viaPages.push(...page.items.map((t) => t.taskId));
    }
    expect(viaPages).toHaveLength(5);

    const all = onceListStore(api.tasks.all, { workspaceId });
    const s = await waitFor(all, (x) => x.status !== "loading");
    expect(s.items.map((t) => t.taskId)).toEqual(viaPages);

    const recent = onceListStore(
      api.tasks.all,
      { workspaceId },
      { pageSize: 2, fields: { pick: ["title"] } },
    );
    let r = await waitFor(recent, (x) => x.status !== "loading");
    expect(r.items).toHaveLength(2);
    expect(Object.keys(r.items[0]!).sort()).toEqual([
      "taskId",
      "title",
      "workspaceId",
    ]);
    recent.fetchMore();
    r = await waitFor(recent, (x) => !x.isFetchingMore && x.items.length > 2);
    expect(r.items.map((t) => t.taskId)).toEqual(viaPages.slice(0, 4));
    expect(r.hasMore).toBe(true);

    const item = onceItemStore(api.tasks.get, {
      workspaceId,
      taskId: viaPages[0]!,
    });
    const i = await waitFor(item, (x) => x.status !== "loading");
    expect(i.item?.taskId).toBe(viaPages[0]);
    expect(typeof i.token).toBe("string");
  });

  it("認証コンテキストを使うクエリ", async () => {
    const key = newKey();
    await api.tasks.create(key, newTask({ assignee: "carol" }));
    const mine = await as("carol").tasks.mine({ workspaceId: "ws1" });
    expect(mine.items.map((t) => t.taskId)).toContain(key.taskId);
    const others = await as("dave").tasks.mine({ workspaceId: "ws1" });
    expect(others.items.map((t) => t.taskId)).not.toContain(key.taskId);
  });
});

describe("can とサーバーの上書き", () => {
  let guarded: TestApp;
  beforeAll(async () => {
    guarded = await startApp({
      overrides: [
        override(taskOps.get, {
          authorize: (ctx, req, shared) =>
            shared(ctx, req) && ctx.userId !== "mallory",
        }),
      ],
    });
  });
  afterAll(async () => {
    await guarded?.close();
  });

  it("can は共有の規則だけで判定する。最終の判定はサーバーの上書きを含む", async () => {
    const mallory = createClient(endpoints, {
      baseUrl: guarded.baseUrl,
      headers: () => ({ "x-user": "mallory" }),
    });
    const key = newKey();
    // ブラウザの can は上書きを知らないので、通る見込みを返す
    expect(
      mallory.tasks.get.can(key, {
        context: resolveAuth({ "x-user": "mallory" }),
      }),
    ).toEqual({ ok: true });
    const error = await mallory.tasks.get(key).catch((e: unknown) => e);
    expect(isClientError(error, "FORBIDDEN")).toBe(true);
  });
});
