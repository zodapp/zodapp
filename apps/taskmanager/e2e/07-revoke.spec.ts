import { expect, test } from "@playwright/test";
import { login, openAs, setupWorkspace } from "./helpers";

test("権限の取り消し：メンバーから外された人の開いている一覧に、変更が届かなくなる", async ({
  page,
  browser,
}, testInfo) => {
  const ws = await setupWorkspace();
  const scope = { workspaceId: ws.workspaceId, projectId: ws.projectId };

  // alice（このテストのページ）と bob（別のブラウザ）で、同じプロジェクトのタスク一覧を開く
  await login(page, "alice@example.com");
  await page.goto(ws.tasksUrl);
  await expect(page.getByRole("heading", { name: "タスク一覧" })).toBeVisible();
  const bob = await openAs(browser, "bob@example.com", testInfo.outputPath("bob-video"));
  await bob.page.goto(ws.tasksUrl);
  await expect(bob.page.getByText("タスクがありません")).toBeVisible();

  // 外す前：alice の作成が bob に届く
  await ws.alice.api.tasks.create(scope, { title: "外す前のタスク" });
  await expect(bob.page.getByRole("row").filter({ hasText: "外す前のタスク" })).toBeVisible();

  // alice が bob をメンバーから外す。サーバーは bob の Realtime の接続を作り直し、購読を止める
  await ws.alice.api.members.remove({ workspaceId: ws.workspaceId, email: "bob@example.com" });
  await expect(bob.page.getByRole("alert")).toHaveText(
    "このワークスペースを表示する権限がありません",
  );

  // 外した後：alice の作成は、bob には届かない
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.getByRole("dialog").getByLabel("タスク名").fill("外した後のタスク");
  await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "外した後のタスク" })).toBeVisible();
  await bob.page.waitForTimeout(1500);
  await expect(bob.page.getByRole("row").filter({ hasText: "外した後のタスク" })).toHaveCount(0);

  await bob.context.close();
});
