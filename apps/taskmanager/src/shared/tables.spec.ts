/**
 * 共有の定義（Table定義・操作・認可）を DynamoDB Local で確かめる。
 * `pnpm infra:up` で DynamoDB Local を起動してから実行する。
 */
import { randomUUID } from "node:crypto";
import { DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDynamoClient, ensureTable } from "../server/dynamo";
import { createServerApi } from "@zodapp/zod-dynamodb-node";
import { createAppRepository, type AppRepository } from "../server/repository";
import { appTable, endpoints, type Auth } from "./index";

const dynamodb = createDynamoClient();
const tableName = `test-${randomUUID()}`;
let repo: AppRepository;
let api: ReturnType<typeof createServerApi<typeof endpoints, unknown>>;

const alice: Auth = { userId: "u-alice", email: "alice@example.com", roles: { ws1: "owner" } };
const viewer: Auth = { userId: "u-vic", email: "vic@example.com", roles: { ws1: "viewer" } };
const outsider: Auth = { userId: "u-eve", email: "eve@example.com", roles: {} };

beforeAll(async () => {
  await ensureTable(dynamodb, appTable, tableName);
  repo = createAppRepository({ dynamodb, tableName });
  api = createServerApi(endpoints, { repository: repo });
});
afterAll(async () => {
  await dynamodb.send(new DeleteTableCommand({ TableName: tableName }));
});

describe("tasks", () => {
  it("active と deleted を deletedAt で分ける", async () => {
    const args = { workspaceId: "ws1", projectId: "p1" };
    const a = await api.tasks.create(args, { title: "A" }, { context: alice });
    const b = await api.tasks.create(args, { title: "B", priority: "high" }, { context: alice });
    const keyB = { workspaceId: "ws1", projectId: "p1", taskId: b.taskId };
    await api.tasks.softDelete(keyB, {}, { context: alice });

    const active = await api.tasks.active(args, { context: alice });
    const deleted = await api.tasks.deleted(args, { context: alice });
    expect(active.items.map((t) => t.taskId)).toEqual([a.taskId]);
    expect(deleted.items.map((t) => t.taskId)).toEqual([b.taskId]);
    expect(deleted.items[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it("viewer は書けず、所属しない人は読めない", async () => {
    const args = { workspaceId: "ws1", projectId: "p1" };
    await expect(api.tasks.create(args, { title: "X" }, { context: viewer })).rejects.toThrow();
    await expect(api.tasks.active(args, { context: outsider })).rejects.toThrow();
    const ok = await api.tasks.active(args, { context: viewer });
    expect(ok.items.length).toBeGreaterThan(0);
  });

  it("部分更新は送った項目だけを変え、既定値で上書きしない", async () => {
    const args = { workspaceId: "ws1", projectId: "p1" };
    const t = await api.tasks.create(
      args,
      { title: "T", status: "doing", priority: "urgent", labels: ["UI"] },
      { context: alice },
    );
    const key = { ...args, taskId: t.taskId };
    await api.tasks.update(key, { title: "T2" }, { context: alice });
    const after = await api.tasks.get(key, { context: alice });
    expect(after).toMatchObject({ title: "T2", status: "doing", priority: "urgent", labels: ["UI"] });
    const doing = await api.tasks.activeByStatus({ ...args, status: "doing" }, { context: alice });
    expect(doing.items.map((x) => x.taskId)).toContain(t.taskId);
    await api.tasks.softDelete(key, {}, { context: alice });
    const doing2 = await api.tasks.activeByStatus({ ...args, status: "doing" }, { context: alice });
    expect(doing2.items.map((x) => x.taskId)).not.toContain(t.taskId);
  });
});

describe("members", () => {
  it("email から所属一覧を引ける", async () => {
    for (const workspaceId of ["ws1", "ws2"]) {
      await repo.members.create(
        { workspaceId, email: "alice@example.com" },
        { displayName: "Alice", role: workspaceId === "ws1" ? "owner" : "member" },
      );
    }
    const mine = await api.members.mine({}, { context: alice });
    expect(mine.items.map((m) => [m.workspaceId, m.role])).toEqual([
      ["ws1", "owner"],
      ["ws2", "member"],
    ]);
  });
});

describe("projects", () => {
  it("admin だけが作れる", async () => {
    const input = { name: "P", status: "active" as const };
    const p = await api.projects.create({ workspaceId: "ws1" }, input, { context: alice });
    expect(p.projectId).toBeTruthy();
    await expect(
      api.projects.create({ workspaceId: "ws1" }, input, { context: viewer }),
    ).rejects.toThrow();
    const list = await api.projects.byStatus(
      { workspaceId: "ws1", status: "active" },
      { context: viewer },
    );
    expect(list.items.map((x) => x.projectId)).toEqual([p.projectId]);
  });
});
