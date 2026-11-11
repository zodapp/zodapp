import { expect, test } from "@playwright/test";
import { setupWorkspace } from "./helpers";

test("テストデータ：期限つきのタスクを、サーバーの bulkWrite でまとめて入れる", async () => {
  const ws = await setupWorkspace();
  const scope = { workspaceId: ws.workspaceId, projectId: ws.projectId };
  const dueAt = new Date("2030-01-02T03:04:05.000Z");
  // JSON にすると dueAt は文字列になる。サーバーが Date に戻して受け付ける
  await ws.alice.post("/test-data/tasks", {
    ...scope,
    tasks: Array.from({ length: 30 }, (_, i) => ({ title: `bulk ${i}`, dueAt })),
  });
  const active = await ws.alice.api.tasks.active(scope);
  expect(active.items).toHaveLength(30);
  expect(active.items[0]?.dueAt).toEqual(dueAt);
});
