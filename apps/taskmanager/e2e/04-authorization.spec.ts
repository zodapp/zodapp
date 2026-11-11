import { expect, test } from "@playwright/test";
import { apiAs, login, setupWorkspace } from "./helpers";

test("認可：閲覧者は作成できず、API を直接呼んでも FORBIDDEN", async ({ page }) => {
  const ws = await setupWorkspace();
  const task = await ws.alice.api.tasks.create(
    { workspaceId: ws.workspaceId, projectId: ws.projectId },
    { title: "閲覧者が見るタスク" },
  );

  // 画面：一覧は見えるが、新規作成のボタンは押せない。詳細は読み取り専用
  await login(page, "vic@example.com");
  await page.goto(ws.tasksUrl);
  const row = page.getByRole("row").filter({ hasText: "閲覧者が見るタスク" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("button", { name: "新規作成" })).toBeDisabled();
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "タスク詳細" })).toBeVisible();
  await expect(page.getByRole("button", { name: "更新" })).toHaveCount(0);

  // API：閲覧者のトークンで書き込むと FORBIDDEN
  const vic = await apiAs("vic@example.com");
  const key = { workspaceId: ws.workspaceId, projectId: ws.projectId, taskId: task.taskId };
  await expect(
    vic.api.tasks.create({ workspaceId: ws.workspaceId, projectId: ws.projectId }, { title: "x" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(vic.api.tasks.update(key, { title: "x" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  // 所属していないワークスペースは、読むこともできない
  const { workspaceId: other } = await ws.alice.post<{ workspaceId: string }>("/workspaces", {
    workspace: { name: "alice だけ" },
    ownerDisplayName: "Alice",
    members: [],
  });
  const bob = await apiAs("bob@example.com");
  await expect(
    bob.api.tasks.active({ workspaceId: other, projectId: "any" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
