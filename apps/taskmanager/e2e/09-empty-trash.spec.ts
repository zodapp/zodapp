import { expect, test } from "@playwright/test";
import { login, setupWorkspace } from "./helpers";

test("ゴミ箱を空にする：ゴミ箱のタスクだけが消え、アクティブなタスクは残る", async ({ page }) => {
  const ws = await setupWorkspace();
  const scope = { workspaceId: ws.workspaceId, projectId: ws.projectId };
  const kept = await ws.alice.api.tasks.create(scope, { title: "残すタスク" });
  for (const title of ["ゴミ 1", "ゴミ 2"]) {
    const t = await ws.alice.api.tasks.create(scope, { title });
    await ws.alice.api.tasks.softDelete({ ...scope, taskId: t.taskId }, {});
  }
  // ゴミ箱にないタスクは、完全削除できない（サーバーだけの上書き）
  await expect(ws.alice.api.tasks.remove({ ...scope, taskId: kept.taskId })).rejects.toThrow();

  await login(page, "alice@example.com");
  await page.goto(ws.tasksUrl);
  await expect(page.getByRole("heading", { name: "タスク一覧" })).toBeVisible();
  await page.getByText("ゴミ箱", { exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "ゴミ 1" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "ゴミ 2" })).toBeVisible();

  await page.getByRole("button", { name: "ゴミ箱を空にする" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "完全に削除する" }).click();
  // ゴミ箱の一覧は live なので、消えたタスクはすぐに一覧から消える
  await expect(page.getByRole("row").filter({ hasText: "ゴミ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ゴミ箱を空にする" })).toBeDisabled();

  const deleted = await ws.alice.api.tasks.deleted(scope);
  expect(deleted.items).toEqual([]);
  const active = await ws.alice.api.tasks.active(scope);
  expect(active.items.map((t) => t.taskId)).toEqual([kept.taskId]);
});
