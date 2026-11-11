import { expect, test } from "@playwright/test";
import path from "node:path";
import { login, unique } from "./helpers";

const AVATAR = path.join(__dirname, "fixtures", "avatar.png");

test("作成：ワークスペース・メンバー・プロジェクト・タスク", async ({ page }) => {
  const wsName = unique("WS");
  await login(page, "alice@example.com");

  // ワークスペースを作る（3 ステップ）
  await page.getByRole("button", { name: "新規作成" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ワークスペース名").fill(wsName);
  await dialog.getByRole("button", { name: "次へ" }).click();
  await dialog.getByRole("button", { name: "次へ" }).click();
  await dialog.getByRole("button", { name: "作成", exact: true }).click();
  // 作ったワークスペースが一覧に出る。開くとプロジェクト一覧
  const row = page.getByRole("row").filter({ hasText: wsName });
  await expect(row).toBeVisible();
  await row.getByRole("link").click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/projects/);

  // メンバーを追加する（bob はメンバー、vic は閲覧者）
  await page.getByRole("link", { name: "メンバー一覧" }).click();
  await expect(page.getByRole("heading", { name: "メンバー一覧" })).toBeVisible();
  for (const m of [
    { name: "Bob", email: "bob@example.com", role: "メンバー" },
    { name: "Vic", email: "vic@example.com", role: "閲覧者" },
  ]) {
    await page.getByRole("button", { name: "新規追加" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("表示名").fill(m.name);
    await d.getByLabel("メールアドレス").fill(m.email);
    await d.getByLabel("ロール").click();
    await page.getByRole("option", { name: m.role, exact: true }).click();
    await d.getByRole("button", { name: /追加|作成|保存/ }).last().click();
    await expect(page.getByRole("row").filter({ hasText: m.email })).toBeVisible();
  }

  // メンバーのアバター画像をアップロードする（S3Proxy に署名付き URL で PUT）
  await page.getByRole("row").filter({ hasText: "bob@example.com" }).getByRole("link").click();
  await expect(page.getByRole("textbox", { name: "表示名" })).toHaveValue("Bob");
  const uploaded = page.waitForResponse(
    (r) => r.url().includes("/taskmanager-files/") && r.request().method() === "PUT" && r.ok(),
  );
  await page.locator('input[type="file"]').first().setInputFiles(AVATAR);
  await uploaded;
  await page.getByRole("button", { name: "更新" }).click();
  await expect(page).toHaveURL(/\/members$/);
  // 開き直すと、保存した画像を署名付き URL で S3 から読んで表示する
  await page.getByRole("row").filter({ hasText: "bob@example.com" }).getByRole("link").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("img")].some(
          (img) => img.src.includes("/taskmanager-files/") && img.complete && img.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);

  // プロジェクトを作る
  await page.getByRole("link", { name: "プロジェクト一覧" }).click();
  await expect(page.getByRole("heading", { name: "プロジェクト一覧" })).toBeVisible();
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.getByRole("dialog").getByLabel("プロジェクト名").fill("Alpha");
  await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();
  const projectRow = page.getByRole("row").filter({ hasText: "Alpha" });
  await expect(projectRow).toBeVisible();
  await projectRow.getByRole("link").click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/tasks/);
  // ページは遅延読み込みなので、URL が変わってもしばらく前のページが出ている。見出しを待つ
  await expect(page.getByRole("heading", { name: "タスク一覧" })).toBeVisible();

  // タスクを作る。一覧に出て、詳細を開ける
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.getByRole("dialog").getByLabel("タスク名").fill("最初のタスク");
  await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();
  const taskRow = page.getByRole("row").filter({ hasText: "最初のタスク" });
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "タスク詳細" })).toBeVisible();
  await expect(page.getByLabel("タスク名").first()).toHaveValue("最初のタスク");
});
