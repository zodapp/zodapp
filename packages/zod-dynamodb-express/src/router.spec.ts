import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  defineContext,
  defineEndpoints,
  physicalTable,
  tableConfig,
  type Endpoint,
} from "@zodapp/zod-dynamodb";
import {
  createRepository,
  createServerApi,
  UnauthenticatedError,
} from "@zodapp/zod-dynamodb-node";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { handle, router } from "./index";
import { createTestTable, localClient } from "./test/local";

// ---- 共有の定義 ----

const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" },
    GSI2: { pk: "PK2", sk: "SK2", projection: "KEYS_ONLY" },
  },
});

const taskItem = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
  title: z.string(),
  status: z.enum(["todo", "doing", "done"]),
  assignee: z.string(),
  estimate: z.bigint().optional(),
  tags: z.set(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskItem,
  create: taskItem.omit({
    workspaceId: true,
    taskId: true,
    createdAt: true,
    updatedAt: true,
  }),
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["taskId"],
    },
    byAssignee: {
      slot: "GSI2",
      partition: ["workspaceId", "assignee"],
      sort: ["taskId"],
    },
  },
  onCreate: ({ now }) => ({ createdAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});

type Auth = { userId: string; workspaces: string[] };
const { createOps, override } = defineContext<Auth>();
const inWs = (ctx: Auth, workspaceId: string) =>
  ctx.workspaces.includes(workspaceId);

const taskOps = createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => inWs(ctx, key.workspaceId) }),
  create: o.create({
    authorize: (ctx, { key }) => inWs(ctx, key.workspaceId),
  }),
  set: o.set({ authorize: (ctx, { key }) => inWs(ctx, key.workspaceId) }),
  remove: o.delete({
    authorize: (ctx, { key }) => inWs(ctx, key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => inWs(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
    // 担当者だけが変更できる
    where: (_p, ctx) => ({ assignee: ctx.userId }),
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    authorize: (ctx, { params }) => inWs(ctx, params.workspaceId),
    direction: "asc",
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  mine: o.query({
    index: "byAssignee",
    params: z.object({ workspaceId: z.string() }),
    authorize: (ctx, { params }) => inWs(ctx, params.workspaceId),
    select: "projection",
    where: (p, ctx) => ({
      partition: { workspaceId: p.workspaceId, assignee: ctx.userId },
    }),
  }),
  purge: o.delete(),
}));

const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.set, path: "/tasks/set" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    { op: taskOps.byStatus, path: "/tasks/by-status", method: "GET" },
    { op: taskOps.mine },
    { op: taskOps.purge },
  ],
});

// ---- サーバー ----

const client = localClient();
let table: Awaited<ReturnType<typeof createTestTable>>;
let server: Server;
let base: string;
const passedToNext: unknown[] = [];
const internalErrors: unknown[] = [];

const contextOf = (req: express.Request): Auth => {
  const userId = req.header("x-user");
  if (userId === "explode") throw new Error("auth backend down");
  if (userId === "forged") throw new UnauthenticatedError("bad token");
  return {
    userId: userId ?? "anonymous",
    workspaces: ["ws1"],
    ...(userId === "expired" ? { expired: true } : {}),
  };
};

beforeAll(async () => {
  table = await createTestTable(client, appTable);
  const repository = createRepository({
    tables: { tasks },
    dynamodb: client,
    tableNames: { app: table.name },
    cursorSecret: "secret",
  });
  const serverApi = createServerApi(endpoints, {
    repository,
    context: contextOf,
    checkContext: (ctx: { expired?: boolean }) => {
      if (ctx.expired) throw new UnauthenticatedError("expired");
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router(serverApi, { onError: (e) => internalErrors.push(e) }));
  // パスを自分で決める
  app.get(
    "/tasks/:workspaceId/mine",
    handle(serverApi.tasks.mine, {
      input: (req) => ({ params: { workspaceId: req.params.workspaceId } }),
    }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      passedToNext.push(error);
      res.status(599).json({ app: true });
    },
  );
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await table?.drop();
});

const codec = (op: { name: string }): Endpoint =>
  endpoints.entryByName("tasks", op.name)!.endpoint!;

/** Client の代わり：入力を encode して送り、出力を decode する */
const call = async (
  op: { name: string },
  input: unknown,
  user = "u1",
): Promise<{ status: number; body: any; output?: any }> => {
  const e = codec(op);
  const json = e.encodeInput(input);
  const res =
    e.method === "GET"
      ? await fetch(
          `${base}${e.path}?input=${encodeURIComponent(JSON.stringify(json))}`,
          { headers: { "x-user": user } },
        )
      : await fetch(base + e.path, {
          method: e.method,
          headers: { "content-type": "application/json", "x-user": user },
          body: JSON.stringify(json),
        });
  const body = await res.json();
  return {
    status: res.status,
    body,
    output: res.status === 200 ? e.decodeOutput(body, input) : undefined,
  };
};

let seq = 0;
const newKey = () => ({ workspaceId: "ws1", taskId: `t${++seq}` });
const newTask = (extra: Record<string, unknown> = {}) => ({
  title: "a",
  status: "todo" as const,
  assignee: "u1",
  ...extra,
});

describe("router", () => {
  it("作成と取得。Date・bigint・Set を往復し、Get はトークンも返す", async () => {
    const key = newKey();
    const created = await call(taskOps.create, {
      key,
      input: newTask({ estimate: 10n ** 20n, tags: new Set(["x", "y"]) }),
    });
    expect(created.status).toBe(200);
    expect(created.output.item.createdAt).toBeInstanceOf(Date);
    expect(created.body.item.estimate).toBe("100000000000000000000");

    const got = await call(taskOps.get, key);
    expect(got.output.item.estimate).toBe(10n ** 20n);
    expect(got.output.item.tags).toEqual(new Set(["x", "y"]));
    expect(typeof got.output.token).toBe("string");
    expect((await call(taskOps.get, newKey())).body).toEqual({ item: null });
  });

  it("不正な入力は INVALID_INPUT と issues", async () => {
    const res = await call(taskOps.create, {
      key: { workspaceId: "ws1", taskId: "x" },
      input: { title: 1 },
    }).catch(() => undefined);
    // encode の時点で検証に失敗するので、生の JSON を送る
    expect(res).toBeUndefined();
    const raw = await fetch(`${base}/tasks/create`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user": "u1" },
      body: JSON.stringify({
        key: { workspaceId: "ws1", taskId: "x" },
        input: { title: 1 },
      }),
    });
    expect(raw.status).toBe(400);
    const body = await raw.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(body.issues.map((i: { path: unknown[] }) => i.path)).toContainEqual([
      "input",
      "title",
    ]);
  });

  it("authorize が false なら FORBIDDEN", async () => {
    const res = await call(taskOps.get, { workspaceId: "other", taskId: "t" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      code: "FORBIDDEN",
      message: expect.any(String),
    });
  });

  it("ALREADY_EXISTS、置き換え、削除（ブラウザには削除前の Item を返さない）", async () => {
    const key = newKey();
    await call(taskOps.create, { key, input: newTask() });
    const dup = await call(taskOps.create, { key, input: newTask() });
    expect(dup.status).toBe(409);
    const now = new Date();
    const replaced = await call(taskOps.set, {
      key,
      input: {
        ...key,
        ...newTask({ title: "b" }),
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(replaced.output.item.title).toBe("b");
    const deleted = await call(taskOps.remove, { key });
    expect(deleted).toMatchObject({ status: 200, body: {} });
  });

  it("ミューテーションの where に認証コンテキストを渡す。Item がない場合と同じ NOT_FOUND", async () => {
    const key = newKey();
    await call(taskOps.create, { key, input: newTask() });
    const ok = await call(taskOps.setStatus, {
      key,
      params: { status: "done" },
    });
    expect(ok.output.item.status).toBe("done");
    const notAssignee = await call(
      taskOps.setStatus,
      { key, params: { status: "doing" } },
      "u2",
    );
    const missing = await call(taskOps.setStatus, {
      key: newKey(),
      params: { status: "doing" },
    });
    expect(notAssignee.status).toBe(404);
    expect(notAssignee.body).toEqual(missing.body);
  });

  it("ifUnchanged：Get のトークンを往復し、変わっていれば CONFLICT", async () => {
    const key = newKey();
    await call(taskOps.create, { key, input: newTask() });
    const token = (await call(taskOps.get, key)).output.token;
    const first = await call(taskOps.setStatus, {
      key,
      params: { status: "doing" },
      ifUnchanged: token,
    });
    expect(first.status).toBe(200);
    const stale = await call(taskOps.setStatus, {
      key,
      params: { status: "done" },
      ifUnchanged: token,
    });
    expect(stale.body.code).toBe("CONFLICT");
  });

  it("GET のクエリ、ページネーション、fields、改ざんしたトークンの拒否", async () => {
    const workspaceId = "ws1";
    const status = "doing" as const;
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const key = { workspaceId, taskId: `q${seq}-${i}` };
      ids.push(key.taskId);
      await call(taskOps.create, { key, input: newTask({ status }) });
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await call(taskOps.byStatus, {
        params: { workspaceId, status },
        limit: 2,
        cursor,
        fields: { pick: ["title"] },
      });
      expect(page.status).toBe(200);
      for (const item of page.output.items) {
        expect(Object.keys(item).sort()).toEqual([
          "taskId",
          "title",
          "workspaceId",
        ]);
      }
      seen.push(...page.output.items.map((t: { taskId: string }) => t.taskId));
      cursor = page.output.cursor;
      if (cursor) {
        const bad = await call(taskOps.byStatus, {
          params: { workspaceId, status },
          cursor: cursor.slice(0, -2) + "xx",
        });
        expect(bad.body.code).toBe("INVALID_CURSOR");
      }
    } while (cursor);
    expect(seen).toEqual(expect.arrayContaining(ids));
  });

  it("path のない操作は公開しない。handle で個別に公開できる", async () => {
    const key = newKey();
    await call(taskOps.create, { key, input: newTask({ assignee: "carol" }) });
    const res = await fetch(`${base}/tasks/ws1/mine`, {
      headers: { "x-user": "carol" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      { workspaceId: "ws1", taskId: key.taskId, assignee: "carol" },
    ]);
  });

  it("context で投げたエラーは next に渡す", async () => {
    passedToNext.length = 0;
    const a = await call(taskOps.get, newKey(), "explode");
    expect(a.status).toBe(599);
    expect(passedToNext.map((e) => (e as Error).message)).toEqual([
      "auth backend down",
    ]);
  });

  it("UnauthenticatedError（context でも checkContext でも）は 401 UNAUTHENTICATED", async () => {
    passedToNext.length = 0;
    for (const user of ["forged", "expired"]) {
      const a = await call(taskOps.get, newKey(), user);
      expect(a.status).toBe(401);
      expect(a.body.code).toBe("UNAUTHENTICATED");
    }
    expect(passedToNext).toEqual([]);
  });

  it("予期しないエラーは INTERNAL にし、メッセージを返さない", async () => {
    internalErrors.length = 0;
    const serverApi = createServerApi(endpoints, {
      repository: createRepository({
        tables: { tasks },
        dynamodb: client,
        tableNames: { app: "no-such-table" },
      }),
      context: () => ({ userId: "u1", workspaces: ["ws1"] }),
    });
    const app = express();
    app.use(express.json());
    app.use(router(serverApi, { onError: (e) => internalErrors.push(e) }));
    const s = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
    });
    try {
      const port = (s.address() as AddressInfo).port;
      const res = await fetch(`http://127.0.0.1:${port}/tasks/get`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws1", taskId: "t1" }),
      });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("INTERNAL");
      expect(JSON.stringify(body)).not.toContain("no-such-table");
      expect(internalErrors).toHaveLength(1);
    } finally {
      await new Promise((resolve) => s.close(resolve));
    }
  });

  it("context のないサーバーの API では、router と handle を作れない", () => {
    const serverApi = createServerApi(endpoints, {
      repository: createRepository({ tables: { tasks }, dynamodb: client }),
    });
    expect(() => router(serverApi)).toThrow(/needs the context option/);
    expect(() => handle(serverApi.tasks.get)).toThrow(
      /needs the context option/,
    );
    // 公開する操作がなければ作れる
    const serverOnly = createServerApi(
      defineEndpoints({ tasks: [{ op: taskOps.purge }] }),
      { repository: createRepository({ tables: { tasks }, dynamodb: client }) },
    );
    expect(() => router(serverOnly)).not.toThrow();
  });

  it("scope() と router を両方使っても、context は 1 リクエストで 1 回", async () => {
    const calls: string[] = [];
    const serverApi = createServerApi(endpoints, {
      repository: createRepository({
        tables: { tasks },
        dynamodb: client,
        tableNames: { app: table.name },
        cursorSecret: "secret",
      }),
      context: (req: express.Request) => {
        calls.push(req.header("x-user") ?? "");
        return contextOf(req);
      },
    });
    const app = express();
    app.use(express.json());
    app.use(serverApi.scope());
    app.use(router(serverApi));
    const s = await new Promise<Server>((resolve) => {
      const x = app.listen(0, "127.0.0.1", () => resolve(x));
    });
    try {
      const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
      const e = codec(taskOps.get);
      for (const user of ["u1", "u2"]) {
        const res = await fetch(url + e.path, {
          method: e.method,
          headers: { "content-type": "application/json", "x-user": user },
          body: JSON.stringify(e.encodeInput(newKey())),
        });
        expect(res.status).toBe(200);
      }
      // リクエストごとに 1 回。別のリクエストでは別に作る
      expect(calls).toEqual(["u1", "u2"]);
    } finally {
      await new Promise((resolve) => s.close(resolve));
    }
  });

  it("上書きの authorize が false なら FORBIDDEN", async () => {
    const serverApi = createServerApi(endpoints, {
      repository: createRepository({
        tables: { tasks },
        dynamodb: client,
        tableNames: { app: table.name },
        cursorSecret: "secret",
        overrides: [
          override(taskOps.get, {
            authorize: (ctx, req, shared) =>
              shared(ctx, req) && ctx.userId !== "mallory",
          }),
        ],
      }),
      context: contextOf,
    });
    const app = express();
    app.use(express.json());
    app.use(router(serverApi));
    const s = await new Promise<Server>((resolve) => {
      const x = app.listen(0, "127.0.0.1", () => resolve(x));
    });
    try {
      const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
      const e = codec(taskOps.get);
      const get = (user: string) =>
        fetch(url + e.path, {
          method: e.method,
          headers: { "content-type": "application/json", "x-user": user },
          body: JSON.stringify(e.encodeInput(newKey())),
        });
      const denied = await get("mallory");
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe("FORBIDDEN");
      // 共有の規則だけなら通る利用者は読める
      expect((await get("u1")).status).toBe(200);
    } finally {
      await new Promise((resolve) => s.close(resolve));
    }
  });

  it("サーバー専用の操作は handle に渡せない", () => {
    const serverApi = createServerApi(endpoints, {
      repository: createRepository({ tables: { tasks }, dynamodb: client }),
    });
    expect(() => handle(serverApi.tasks.purge)).toThrow(/server-only/);
  });
});
