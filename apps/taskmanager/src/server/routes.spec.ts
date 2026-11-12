/**
 * サーバーだけのルート（routes.ts）を DynamoDB Local で確かめる。
 * `pnpm infra:up` で DynamoDB Local を起動してから実行する。
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import express from "express";
import { createServerApi } from "@zodapp/zod-dynamodb-node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appTable, endpoints, type Auth } from "../shared";
import { createDynamoClient, ensureTable } from "./dynamo";
import { createAppRepository, type AppRepository } from "./repository";
import { createAppRoutes } from "./routes";

const dynamodb = createDynamoClient();
const tableName = `test-${randomUUID()}`;
const alice: Auth = { userId: "u-alice", email: "alice@example.com", roles: { ws1: "owner" } };
const viewer: Auth = { userId: "u-vic", email: "vic@example.com", roles: { ws1: "viewer" } };
const users: Record<string, Auth> = { alice, viewer };

let repo: AppRepository;
let api: ReturnType<typeof createServerApi<typeof endpoints, unknown>>;
let server: Server;
let baseUrl: string;

/** テストでは、ヘッダーの名前で認証コンテキストを選ぶ */
const post = async (as: string, path: string, body: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user": as },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

beforeAll(async () => {
  await ensureTable(dynamodb, appTable, tableName);
  repo = createAppRepository({ dynamodb, tableName });
  api = createServerApi(endpoints, { repository: repo });
  const app = express();
  app.use(express.json());
  app.use(
    createAppRoutes({
      repository: repo,
      serverApi: api,
      resolveAuth: async (req) => users[String(req.headers["x-user"])]!,
    }),
  );
  app.use(((error, _req, res, _next) => {
    res.status(500).json({ code: "INTERNAL", message: String(error) });
  }) as express.ErrorRequestHandler);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await dynamodb.send(new DeleteTableCommand({ TableName: tableName }));
});

describe("POST /tasks/empty-trash", () => {
  it("ゴミ箱のタスクだけを消す（100 件を超えても分けて消す）", async () => {
    const args = { workspaceId: "ws1", projectId: "p-trash" };
    const kept = await api.tasks.create(args, { title: "kept" }, { context: alice });
    await repo.tasks.bulkWrite({
      scope: args,
      items: Array.from({ length: 120 }, (_, i) => ({
        key: { ...args, taskId: `t${String(i).padStart(3, "0")}` },
        input: { title: `trash ${i}` },
      })),
    });
    for (let i = 0; i < 120; i++) {
      await api.tasks.softDelete(
        { ...args, taskId: `t${String(i).padStart(3, "0")}` },
        {},
        { context: alice },
      );
    }

    // viewer は消せない
    expect((await post("viewer", "/tasks/empty-trash", args)).status).toBe(403);

    const res = await post("alice", "/tasks/empty-trash", args);
    expect(res).toEqual({ status: 200, body: { deleted: 120 } });
    const deleted = await api.tasks.deleted(args, { context: alice });
    expect(deleted.items).toEqual([]);
    const active = await api.tasks.active(args, { context: alice });
    expect(active.items.map((t) => t.taskId)).toEqual([kept.taskId]);
  });
});

describe("POST /tasks/move", () => {
  it("移動先がなければ 404、アクティブでなければ 409（check）", async () => {
    const workspaceId = "ws1";
    const from = await api.projects.create({ workspaceId }, { name: "from" }, { context: alice });
    const archived = await api.projects.create(
      { workspaceId },
      { name: "archived", status: "archived" },
      { context: alice },
    );
    const to = await api.projects.create({ workspaceId }, { name: "to" }, { context: alice });
    const task = await api.tasks.create(
      { workspaceId, projectId: from.projectId },
      { title: "move me" },
      { context: alice },
    );
    const body = { workspaceId, projectId: from.projectId, taskId: task.taskId };

    expect(
      (await post("alice", "/tasks/move", { ...body, toProjectId: "no-such-project" })).status,
    ).toBe(404);
    expect(
      (await post("alice", "/tasks/move", { ...body, toProjectId: archived.projectId })).status,
    ).toBe(409);
    // 失敗したときは、元のプロジェクトに残っている
    expect(
      await api.tasks.get({ workspaceId, projectId: from.projectId, taskId: task.taskId }, { context: alice }),
    ).not.toBeNull();

    const res = await post("alice", "/tasks/move", { ...body, toProjectId: to.projectId });
    expect(res).toEqual({
      status: 200,
      body: { workspaceId, projectId: to.projectId, taskId: task.taskId },
    });
  });
});
