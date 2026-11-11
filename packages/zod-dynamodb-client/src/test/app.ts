/**
 * テスト用のアプリケーション。コントラクト（共有モジュールに置くもの）と、
 * それを公開する Express のサーバーを、DynamoDB Local の上に作る。
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  defineContext,
  defineEndpoints,
  physicalTable,
  tableConfig,
} from "@zodapp/zod-dynamodb";
import { router } from "@zodapp/zod-dynamodb-express";
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import {
  createRepository,
  createServerApi,
  type Repository,
  type ServerApiInstance,
} from "@zodapp/zod-dynamodb-node";
import express from "express";
import { z } from "zod";
import { createTestTable, localClient } from "./local";

// ---- 共有の定義 ----

export const appTable = physicalTable({
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
  priority: z.int().min(0).max(9),
  assignee: z.string(),
  estimate: z.bigint().optional(),
  tags: z.set(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const tasks = tableConfig({
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
      sort: ["priority", "taskId"],
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

export type Auth = { userId: string; workspaces: string[] };

export const canAccess = (ctx: Auth, workspaceId: string) =>
  ctx.workspaces.includes(workspaceId);

export const { createOps, override } = defineContext<Auth>();

const byStatusSpec = {
  index: "byStatus",
  params: z.object({
    workspaceId: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    minPriority: z.int().default(0),
  }),
  authorize: (ctx: Auth, { params }: { params: { workspaceId: string } }) =>
    canAccess(ctx, params.workspaceId),
  direction: "desc",
} as const;

export const taskOps = createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => canAccess(ctx, key.workspaceId) }),
  getByPath: o.get({
    authorize: (ctx, { key }) => canAccess(ctx, key.workspaceId),
  }),
  create: o.create({
    authorize: (ctx, { key }) => canAccess(ctx, key.workspaceId),
  }),
  remove: o.delete({
    authorize: (ctx, { key }) => canAccess(ctx, key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => canAccess(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
    // 担当者だけが変更できる
    where: (_p, ctx) => ({ assignee: ctx.userId }),
  }),
  byStatus: o.query({
    ...byStatusSpec,
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
  }),
  byStatusGet: o.query({
    ...byStatusSpec,
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
  }),
  all: o.query({
    params: z.object({ workspaceId: z.string() }),
    authorize: (ctx, { params }) => canAccess(ctx, params.workspaceId),
    direction: "asc",
    where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
  }),
  mine: o.query({
    index: "byAssignee",
    params: z.object({ workspaceId: z.string() }),
    authorize: (ctx, { params }) => canAccess(ctx, params.workspaceId),
    direction: "asc",
    where: (p, ctx) => ({
      partition: { workspaceId: p.workspaceId, assignee: ctx.userId },
    }),
  }),
}));

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    {
      op: taskOps.getByPath,
      path: "/tasks/:workspaceId/:taskId",
      method: "GET",
    },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { pick: ["title"] } },
    },
    {
      op: taskOps.byStatusGet,
      path: "/workspaces/:workspaceId/tasks",
      method: "GET",
    },
    { op: taskOps.all, path: "/tasks/all", live: true },
    { op: taskOps.mine, path: "/tasks/mine", live: true },
  ],
});

// ---- サーバー ----

/** リクエストのヘッダーから認証コンテキストを作る（HTTPとリアルタイムで共有する） */
export const resolveAuth = (headers: Record<string, unknown>): Auth => {
  const userId = headers["x-user"];
  return {
    userId: typeof userId === "string" ? userId : "anonymous",
    workspaces: ["ws1", "ws2", "ws3"],
  };
};

export type TestApp = {
  baseUrl: string;
  server: Server;
  app: express.Express;
  repository: Repository<{ tasks: typeof tasks }>;
  /** サーバーの API（`createServerApi`） */
  serverApi: ServerApiInstance<typeof endpoints, any>;
  /** `mqttUrl` を指定したときの Realtime Gateway の URL（`?user=` で利用者を指定する） */
  realtimeUrl: string;
  close: () => Promise<void>;
};

export const startApp = async (
  options: {
    listener?: Parameters<typeof createRepository>[0]["listener"];
    /** Repository に渡す、サーバーの上書き */
    overrides?: Parameters<typeof createRepository>[0]["overrides"];
    /** 指定すると、MQTT での発行と Realtime Gateway を用意する */
    mqttUrl?: string;
  } = {},
): Promise<TestApp> => {
  const publisher = options.mqttUrl
    ? mqttPublisher({ url: options.mqttUrl, prefix: "app", endpoints })
    : undefined;
  const dynamodb = localClient();
  const table = await createTestTable(dynamodb, appTable);
  const repository = createRepository({
    tables: { tasks },
    dynamodb,
    tableNames: { app: table.name },
    cursorSecret: "secret",
    listener: publisher ?? options.listener,
    overrides: options.overrides,
  });
  const serverApi = createServerApi(endpoints, {
    repository,
    // HTTP はヘッダーから。ブラウザの WebSocket はヘッダーを付けられないので、テストではクエリ文字列で利用者を渡す
    context: (req: { headers: Record<string, unknown>; url?: string }) =>
      resolveAuth({
        "x-user":
          req.headers["x-user"] ??
          new URL(req.url ?? "/", "http://x").searchParams.get("user"),
      }),
  });

  const app = express();
  app.use(express.json());
  app.use(router(serverApi, { onError: () => {} }));

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;

  const gateway = options.mqttUrl
    ? createRealtimeGateway({
        api: serverApi,
        transport: mqttTransport({ url: options.mqttUrl }),
        prefix: "app",
        onError: (e) => console.error(e),
      })
    : undefined;
  gateway?.attach(server, { path: "/realtime" });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
    app,
    repository,
    serverApi,
    realtimeUrl: `ws://127.0.0.1:${port}/realtime`,
    close: async () => {
      await gateway?.close();
      await publisher?.close();
      await new Promise((resolve) => server.close(resolve));
      await table.drop();
    },
  };
};
