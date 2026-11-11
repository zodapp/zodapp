import { expect, test } from "@playwright/test";
import { login, openAs, setupWorkspace } from "./helpers";

test("リアルタイム：alice の変更が、bob の一覧にすぐ届く", async ({ page, browser }, testInfo) => {
  const ws = await setupWorkspace();

  // alice（このテストのページ）と bob（別のブラウザ）で、同じプロジェクトのタスク一覧を開く
  await login(page, "alice@example.com");
  await page.goto(ws.tasksUrl);
  await expect(page.getByRole("heading", { name: "タスク一覧" })).toBeVisible();
  const bob = await openAs(browser, "bob@example.com", testInfo.outputPath("bob-video"));
  await bob.page.goto(ws.tasksUrl);
  await expect(bob.page.getByText("タスクがありません")).toBeVisible();

  // 作成：alice が画面で作ると、bob の一覧に出る
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.getByRole("dialog").getByLabel("タスク名").fill("リアルタイムのタスク");
  await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();
  const bobRow = bob.page.getByRole("row").filter({ hasText: "リアルタイムのタスク" });
  await expect(bobRow).toBeVisible();
  await expect(bobRow).toContainText("未着手");

  // ステータスの変更：行を選んで一括変更すると、bob の行のステータスが変わる
  const aliceRow = page.getByRole("row").filter({ hasText: "リアルタイムのタスク" });
  await aliceRow.getByRole("checkbox", { name: "行を選択" }).check();
  await page.getByRole("button", { name: "ステータス一括変更" }).click();
  await page.getByRole("menuitem", { name: "完了" }).click();
  await expect(bobRow).toContainText("完了");

  // ゴミ箱へ：alice が詳細から削除すると、bob の一覧から消え、ゴミ箱に出る
  await aliceRow.getByRole("link").click();
  // ページは遅延読み込みなので、URL が変わってもしばらく前のページが出ている。見出しを待つ
  await expect(page.getByRole("heading", { name: "タスク詳細" })).toBeVisible();
  await page.getByRole("button").filter({ has: page.locator("svg.tabler-icon-dots-vertical") }).click();
  await page.getByRole("menuitem", { name: "タスクを削除" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /削除/ }).last().click();
  await expect(bobRow).toHaveCount(0);
  await bob.page.getByText("ゴミ箱").click();
  await expect(
    bob.page.getByRole("row").filter({ hasText: "リアルタイムのタスク" }),
  ).toBeVisible();

  await bob.context.close();
});
