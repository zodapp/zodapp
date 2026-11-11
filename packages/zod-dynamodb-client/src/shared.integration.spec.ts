/**
 * 1 つの共有コードを、ブラウザの API（createClient）とサーバーの API（createServerApi）の両方で動かす。
 * 共有コードは API の型（Api）だけに依存し、どちらの実装かを知らない。
 */
import type { SharedApi } from "@zodapp/zod-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "./api";
import { runWithContext } from "@zodapp/zod-dynamodb-node";
import {
  endpoints,
  startApp,
  taskOps,
  type Auth,
  type TestApp,
} from "./test/app";

// ---- 共有コード（ブラウザとサーバーの両方で使う） ----

/** 未完了のタスクを、すべて完了にする。変更できないもの（担当者でないもの）は送る前に飛ばす */
export const finishAll = async (
  api: SharedApi<typeof endpoints>,
  workspaceId: string,
) => {
  const finished: string[] = [];
  for await (const page of api.tasks.all.pages({ workspaceId })) {
    for (const task of page.items) {
      if (task.status === "done") continue;
      const key = { workspaceId: task.workspaceId, taskId: task.taskId };
      // 送る前に同期で判定する（authorize と where）
      if (!api.tasks.setStatus.can(key, { status: "done" }, { item: task }).ok)
        continue;
      await api.tasks.setStatus(key, { status: "done" });
      finished.push(task.taskId);
    }
  }
  return finished;
};

// ---- テスト ----

let app: TestApp;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

const auth = (userId: string): Auth => ({
  userId,
  workspaces: ["ws1", "ws2", "ws3"],
});

const seed = async (workspaceId: string) => {
  const repo = app.repository.tasks;
  const base = { title: "x", priority: 1 };
  await repo.create(
    { workspaceId, taskId: "a" },
    { ...base, status: "todo", assignee: "u1" },
  );
  await repo.create(
    { workspaceId, taskId: "b" },
    { ...base, status: "doing", assignee: "u1" },
  );
  await repo.create(
    { workspaceId, taskId: "c" },
    { ...base, status: "done", assignee: "u1" },
  );
  await repo.create(
    { workspaceId, taskId: "d" },
    { ...base, status: "todo", assignee: "u2" },
  );
};

const statuses = async (workspaceId: string) =>
  (await app.repository.tasks.query(taskOps.all, { workspaceId })).items.map(
    (t) => `${t.taskId}:${t.status}`,
  );

describe("共有コードを両側で動かす", () => {
  it("ブラウザの API で動かす（HTTP を通る）", async () => {
    await seed("ws2");
    const api = createClient(endpoints, {
      baseUrl: app.baseUrl,
      headers: () => ({ "x-user": "u1" }),
    }).bind(auth("u1"));
    expect(await finishAll(api, "ws2")).toEqual(["a", "b"]);
    expect(await statuses("ws2")).toEqual([
      "a:done",
      "b:done",
      "c:done",
      "d:todo",
    ]);
  });

  it("サーバーの API で動かす（同じプロセスで Repository を呼ぶ）", async () => {
    await seed("ws3");
    const finished = await runWithContext(auth("u1"), () =>
      finishAll(app.serverApi, "ws3"),
    );
    expect(finished).toEqual(["a", "b"]);
    expect(await statuses("ws3")).toEqual([
      "a:done",
      "b:done",
      "c:done",
      "d:todo",
    ]);
  });
});
