/**
 * テスト用のアプリケーション：DynamoDB Local の Repository、変更の発行、Realtime Gateway。
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createChangePublisher,
  defineContext,
  defineEndpoints,
  memoryTransport,
  physicalTable,
  tableConfig,
  type RealtimeTransport,
} from "@zodapp/zod-dynamodb";
import {
  createRepository,
  createServerApi,
  UnauthenticatedError,
} from "@zodapp/zod-dynamodb-node";
import WebSocket from "ws";
import { z } from "zod";
import { createRealtimeGateway, type RealtimeGatewayOptions } from "../index";
import { createTestTable, localClient } from "./local";

export const appTable = physicalTable({
  name: "rt",
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
  dueAt: z.date().optional(),
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskItem,
  create: taskItem.omit({ workspaceId: true, taskId: true }),
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
});

/** `denied` は、コンテキストを作ったときに読んだ「読めないワークスペース」（ロールの代わり） */
export type Auth = { userId: string; denied: string[]; expiresAt?: number };

export const { createOps, override } = defineContext<Auth>();

export const taskOps = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
      minPriority: z.int().default(0),
    }),
    authorize: (ctx, { params }) =>
      params.workspaceId !== "secret" || ctx.userId === "admin",
    direction: "desc",
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
  }),
  all: o.query({
    params: z.object({ workspaceId: z.string() }),
    authorize: (ctx, { params }) => !ctx.denied.includes(params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
  }),
  mine: o.query({
    index: "byAssignee",
    params: z.object({ workspaceId: z.string() }),
    authorize: () => true,
    where: (p, ctx) => ({
      partition: { workspaceId: p.workspaceId, assignee: ctx.userId },
    }),
  }),
}));

/** 購読の名前は「グループ名.操作の名前」（tasks.byStatus など） */
export const endpoints = defineEndpoints({
  tasks: [
    {
      op: taskOps.byStatus,
      live: { fields: { pick: ["title", "status", "priority"] } },
    },
    { op: taskOps.all, live: true },
    { op: taskOps.mine, live: true },
  ],
});

/**
 * 認証の情報：`x-user` ヘッダー、または `auth` メッセージの `{ user }`。
 * - `ユーザー@期限（ミリ秒の時刻）`：認証の情報そのものの期限（作り直しても延びない）
 * - `ユーザー~寿命（ミリ秒）`：コンテキストの寿命（作るたびに、その時刻から数える）
 */
const parseUser = (raw: string) => {
  const [head, exp] = raw.split("@");
  const [userId, ttl] = head!.split("~");
  return {
    userId: userId!,
    expiresAt: exp ? Number(exp) : ttl ? Date.now() + Number(ttl) : undefined,
  };
};

export const startApp = async (
  options: {
    transport?: () => RealtimeTransport;
    /** false なら `auth` メッセージを受け付けない */
    acceptAuth?: boolean;
    /** コンテキストの作り直しを同時に行う数の上限 */
    maxConcurrentRebuilds?: number;
    /** コンテキストを作るのにかかる時間（ミリ秒）。同時実行数の確認に使う */
    contextDelay?: number;
    /** Gateway に、そのまま渡す設定 */
    /** Repository に渡す、サーバーの上書き */
    overrides?: Parameters<typeof createRepository>[0]["overrides"];
    gateway?: Pick<
      RealtimeGatewayOptions,
      "origin" | "maxSubscriptionsPerConnection"
    >;
  } = {},
) => {
  /** コンテキストを作っている数（いま・最大）と、作った回数 */
  const contextCalls = { active: 0, max: 0, total: 0 };
  /** コンテキストを作れなくする利用者（認証の取り消しの代わり） */
  const blocked = new Set<string>();
  /** ワークスペースごとの、読めない利用者（テストで変える。反映は revalidate のとき） */
  const denied = new Map<string, Set<string>>();
  const memory = memoryTransport();
  const makeTransport = options.transport ?? (() => memory);
  const publisher = createChangePublisher({
    transport: makeTransport(),
    endpoints,
    prefix: "test",
  });
  const dynamodb = localClient();
  const table = await createTestTable(dynamodb, appTable);
  const repository = createRepository({
    tables: { tasks },
    dynamodb,
    tableNames: { rt: table.name },
    cursorSecret: "secret",
    listener: publisher,
    overrides: options.overrides,
  });
  const errors: unknown[] = [];
  const serverApi = createServerApi(endpoints, {
    repository,
    credential: (req: { headers: Record<string, unknown> }) =>
      typeof req.headers["x-user"] === "string"
        ? req.headers["x-user"]
        : undefined,
    context: async (credential: string | undefined): Promise<Auth> => {
      if (credential === undefined || credential === "forged") {
        throw new UnauthenticatedError("unauthenticated");
      }
      const { userId, expiresAt } = parseUser(credential);
      contextCalls.total += 1;
      contextCalls.active += 1;
      contextCalls.max = Math.max(contextCalls.max, contextCalls.active);
      try {
        if (options.contextDelay) {
          await new Promise((r) => setTimeout(r, options.contextDelay));
        }
      } finally {
        contextCalls.active -= 1;
      }
      if (blocked.has(userId)) throw new UnauthenticatedError("blocked");
      return {
        userId,
        denied: [...denied]
          .filter(([, users]) => users.has(userId))
          .map(([w]) => w),
        ...(expiresAt === undefined ? {} : { expiresAt }),
      };
    },
    expiresAt: (ctx: Auth) => ctx.expiresAt,
  });
  const gateway = createRealtimeGateway({
    api: serverApi,
    transport: makeTransport(),
    prefix: "test",
    maxPageSize: 3,
    onError: (e) => errors.push(e),
    ...options.gateway,
    ...(options.maxConcurrentRebuilds
      ? { maxConcurrentRebuilds: options.maxConcurrentRebuilds }
      : {}),
    ...(options.acceptAuth === false
      ? {}
      : {
          credentialOf: (payload: unknown) =>
            z.object({ user: z.string() }).parse(payload).user,
        }),
  });
  const server: Server = createServer();
  gateway.attach(server, { path: "/realtime" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${port}/realtime`,
    repository,
    errors,
    gateway,
    contextCalls,
    /** 利用者のコンテキストを作れなくする */
    block: (userId: string) => blocked.add(userId),
    /** 利用者をワークスペースから外す（認証コンテキストには、作り直すまで反映されない） */
    deny: (workspaceId: string, userId: string) => {
      const users = denied.get(workspaceId) ?? new Set<string>();
      users.add(userId);
      denied.set(workspaceId, users);
    },
    close: async () => {
      await gateway.close();
      await publisher.close();
      await new Promise((resolve) => server.close(resolve));
      await table.drop();
    },
  };
};

type Message = Record<string, any>;

/** テスト用の WebSocket の Client。届いたメッセージを順に待てる */
export const connect = async (
  url: string,
  user = "u1",
  headers: Record<string, string> = {},
) => {
  const ws = new WebSocket(url, { headers: { "x-user": user, ...headers } });
  const received: Message[] = [];
  const waiters: {
    match: (m: Message) => boolean;
    resolve: (m: Message) => void;
  }[] = [];
  const consumed = new Set<Message>();
  const closed = new Promise<number>((resolve) =>
    ws.on("close", (code) => resolve(code)),
  );
  ws.on("message", (data) => {
    const m = JSON.parse(String(data)) as Message;
    received.push(m);
    for (const w of [...waiters]) {
      if (w.match(m)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(m);
        break;
      }
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return {
    ws,
    received,
    send: (m: Message) => ws.send(JSON.stringify(m)),
    /** 条件に合う、まだ受け取っていない最初のメッセージ */
    next: (match: (m: Message) => boolean, timeout = 3000) =>
      new Promise<Message>((resolve, reject) => {
        const take = (m: Message) => !consumed.has(m) && match(m);
        const found = received.find(take);
        if (found) {
          consumed.add(found);
          return resolve(found);
        }
        const timer = setTimeout(() => reject(new Error("timeout")), timeout);
        waiters.push({
          match: take,
          resolve: (m) => {
            clearTimeout(timer);
            consumed.add(m);
            resolve(m);
          },
        });
      }),
    close: () => ws.close(),
    /** 閉じられたときのコード */
    closed,
  };
};
