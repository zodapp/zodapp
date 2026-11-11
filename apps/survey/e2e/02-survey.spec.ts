import { expect, test } from "@playwright/test";
import { login, setupWorkspace } from "./helpers";

test("アンケート：作成して公開し、回答が一覧に出る", async ({ page }) => {
  const { workspaceId } = await setupWorkspace();
  await login(page, "alice@example.com");

  // アンケートを作ると、ビルダーが開く
  await page.goto(`/survey/workspaces/${workspaceId}/surveys`);
  await expect(page.getByRole("heading", { name: "アンケート一覧" })).toBeVisible();
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.getByRole("dialog").getByLabel("アンケート名").fill("E2E アンケート");
  await page.getByRole("dialog").getByRole("button", { name: "作成して編集へ" }).click();
  await expect(page.getByRole("heading", { name: "アンケート編集" })).toBeVisible();
  await expect(page.getByText("下書き", { exact: true }).first()).toBeVisible();

  // 公開すると、版が 1 になる
  await page.getByRole("button", { name: "公開する" }).click();
  await expect(page.getByText("公開中のアンケートです（第 1 版）")).toBeVisible();
  await expect(page).toHaveURL(/\/surveys\/[^/]+\/edit/);
  const surveyId = /\/surveys\/([^/]+)\/edit/.exec(page.url())![1]!;

  // テストデータの定義（質問のある公開中のアンケート）を入れて、回答ページから答える
  await page.goto(`/survey/workspaces/${workspaceId}/test-data`);
  await expect(page.getByRole("heading", { name: "テストデータ" })).toBeVisible();
  await page.getByRole("button", { name: "投入" }).first().click();
  await expect(page.getByText(/3 件を投入しました/)).toBeVisible();

  await page.goto(`/survey/workspaces/${workspaceId}/surveys/fx-satisfaction/answer`);
  await expect(page.getByRole("heading", { name: "サービス満足度アンケート" })).toBeVisible();
  await page.getByLabel("お名前").fill("E2E 太郎");
  await page.getByRole("combobox", { name: "総合満足度" }).click();
  await page.getByRole("option", { name: "とても満足" }).click();
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "回答を送信" }).click();
  await expect(page.getByText("回答を送信しました")).toBeVisible();

  // このアンケートの回答一覧に出る（質問の定義から作った列に、回答が展開される）
  await page.getByRole("link", { name: "回答一覧を見る" }).click();
  await expect(page.getByRole("heading", { name: "回答一覧" })).toBeVisible();
  await expect(page.getByText("サービス満足度アンケート で絞り込み中")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "E2E 太郎" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("とても満足");

  // 詳細では、回答フォームと同じスキーマで読み取り専用に表示する
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "回答詳細" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("E2E 太郎");
  await expect(page.getByRole("main")).toContainText("とても満足");

  // 最初に作ったアンケートは、一覧にある。開くとビルダー
  await page.goto(`/survey/workspaces/${workspaceId}/surveys`);
  const created = page.getByRole("row").filter({ hasText: "E2E アンケート" });
  await expect(created).toBeVisible();
  await created.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/surveys/${surveyId}/edit`));
});
